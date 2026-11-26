#include <SPI.h>
#include <TFT_eSPI.h>
#include <XPT2046_Touchscreen.h>

namespace {
constexpr int TOUCH_CS = 33;
constexpr int BUTTON_PIN = 0;
constexpr int SCREEN_WIDTH = 320;
constexpr int SCREEN_HEIGHT = 240;
constexpr int PLAYER_Y = SCREEN_HEIGHT - 30;
constexpr int ENEMY_COUNT = 5;
constexpr int BULLET_COUNT = 5;
constexpr int STAR_COUNT = 22;
constexpr int PLAYER_BINS = 6;
constexpr int DX_BINS = 3;
constexpr int DISTANCE_BINS = 3;
constexpr int ACTION_COUNT = 3;
constexpr int STATE_COUNT = PLAYER_BINS * DX_BINS * DISTANCE_BINS;
constexpr uint32_t FRAME_MS = 40;
constexpr uint32_t SHOT_MS = 220;
constexpr float LEARNING_RATE = 0.2f;
constexpr float DISCOUNT_RATE = 0.85f;
static_assert(STATE_COUNT == 54, "Q table state count must match the observation bins");

TFT_eSPI tft;
XPT2046_Touchscreen touch(TOUCH_CS);

struct Enemy {
  int x;
  int y;
  int speed;
  int drawX;
  int drawY;
  bool drawn;
};

struct Bullet {
  int x;
  int y;
  int drawX;
  int drawY;
  bool active;
  bool drawn;
};

struct Star {
  int x;
  int y;
  uint16_t color;
};

enum class GameState { OFF, PLAYING, GAME_OVER };

Enemy enemies[ENEMY_COUNT];
Bullet bullets[BULLET_COUNT];
Star stars[STAR_COUNT];
float qValues[STATE_COUNT][ACTION_COUNT] = {};
GameState gameState = GameState::OFF;
int playerX = SCREEN_WIDTH / 2;
int drawnPlayerX = SCREEN_WIDTH / 2;
int score = 3;
int shownScore = -1;
uint32_t shownLearning = UINT32_MAX;
uint32_t learningSteps = 0;
uint32_t lastFrame = 0;
uint32_t lastShot = 0;
uint32_t lastDebounce = 0;
bool lastButtonReading = HIGH;
bool stableButtonState = HIGH;
bool screenNeedsDraw = true;
bool touchWasPressed = false;

void drawHud(bool force = false);
void drawNewGameScreen();

int observeState() {
  const Enemy *target = &enemies[0];
  for (const Enemy &enemy : enemies) {
    if (enemy.y > target->y) target = &enemy;
  }

  const int playerBin = constrain(playerX * PLAYER_BINS / SCREEN_WIDTH, 0, PLAYER_BINS - 1);
  const int offset = target->x - playerX;
  const int dxBin = offset < -18 ? 0 : (offset > 18 ? 2 : 1);
  const int distanceBin = target->y < 80 ? 0 : (target->y < 160 ? 1 : 2);
  return (playerBin * DX_BINS + dxBin) * DISTANCE_BINS + distanceBin;
}

int chooseAction(int state) {
  const int epsilon = max(5, 25 - static_cast<int>(learningSteps / 1000));
  if (random(100) < epsilon) return random(ACTION_COUNT);

  int bestAction = 0;
  for (int action = 1; action < ACTION_COUNT; ++action) {
    if (qValues[state][action] > qValues[state][bestAction]) bestAction = action;
  }
  return bestAction;
}

void learn(int state, int action, int reward, int nextState, bool terminal) {
  float bestFutureValue = qValues[nextState][0];
  for (int nextAction = 1; nextAction < ACTION_COUNT; ++nextAction) {
    bestFutureValue = max(bestFutureValue, qValues[nextState][nextAction]);
  }
  const float target = reward + (terminal ? 0.0f : DISCOUNT_RATE * bestFutureValue);
  qValues[state][action] += LEARNING_RATE * (target - qValues[state][action]);
  ++learningSteps;
}

void spawnEnemy(Enemy &enemy) {
  enemy.x = random(18, SCREEN_WIDTH - 18);
  enemy.y = random(-150, -20);
  enemy.speed = random(2, 5);
  enemy.drawn = false;
}

void resetGame() {
  score = 3;
  playerX = SCREEN_WIDTH / 2;
  for (Enemy &enemy : enemies) spawnEnemy(enemy);
  for (Bullet &bullet : bullets) {
    bullet.active = false;
    bullet.drawn = false;
  }
  lastShot = millis();
  gameState = GameState::PLAYING;
  drawNewGameScreen();
}

void toggleGame() {
  if (gameState == GameState::PLAYING) {
    gameState = GameState::OFF;
    screenNeedsDraw = true;
  } else {
    resetGame();
  }
}

void drawIdleScreen() {
  tft.fillScreen(TFT_NAVY);
  tft.setTextColor(TFT_WHITE, TFT_NAVY);
  tft.setTextDatum(MC_DATUM);
  tft.drawString("MAY BAY", SCREEN_WIDTH / 2, 68, 4);
  tft.setTextColor(TFT_CYAN, TFT_NAVY);
  tft.drawString("AI tu hoc - may bay tu ban", SCREEN_WIDTH / 2, 116, 2);
  tft.setTextColor(TFT_YELLOW, TFT_NAVY);
  tft.drawString("BOOT/cham de bat dau", SCREEN_WIDTH / 2, 158, 2);
  tft.setTextColor(TFT_LIGHTGREY, TFT_NAVY);
  tft.drawString("Trung muc tieu +1 | Lot qua -1", SCREEN_WIDTH / 2, 190, 1);
}

void drawHud(bool force) {
  const int learningDisplay = learningSteps / 100;
  if (force || score != shownScore) {
    tft.fillRect(0, 0, 105, 28, TFT_BLACK);
    tft.setTextDatum(TL_DATUM);
    tft.setTextColor(TFT_WHITE, TFT_BLACK);
    tft.drawString("DIEM " + String(score), 8, 6, 2);
    shownScore = score;
  }
  if (force || learningDisplay != shownLearning) {
    tft.fillRect(SCREEN_WIDTH - 100, 0, 100, 28, TFT_BLACK);
    tft.setTextDatum(TL_DATUM);
    tft.setTextColor(TFT_CYAN, TFT_BLACK);
    tft.drawString("HOC " + String(learningDisplay), SCREEN_WIDTH - 96, 6, 2);
    shownLearning = learningDisplay;
  }
}

void drawNewGameScreen() {
  tft.fillScreen(TFT_NAVY);
  for (Star &star : stars) {
    star.x = random(2, SCREEN_WIDTH - 2);
    star.y = random(34, SCREEN_HEIGHT - 2);
    star.color = random(0, 3) == 0 ? TFT_CYAN : TFT_DARKGREY;
    tft.drawPixel(star.x, star.y, star.color);
  }
  drawnPlayerX = playerX;
  shownScore = -1;
  shownLearning = UINT32_MAX;
  drawHud(true);
  screenNeedsDraw = false;
}

void restoreBackground(int x, int y, int width, int height) {
  const int x0 = max(0, x), y0 = max(32, y);
  const int x1 = min(SCREEN_WIDTH, x + width);
  const int y1 = min(SCREEN_HEIGHT, y + height);
  if (x0 >= x1 || y0 >= y1) return;
  tft.fillRect(x0, y0, x1 - x0, y1 - y0, TFT_NAVY);
  for (const Star &star : stars) {
    if (star.x >= x0 && star.x < x1 && star.y >= y0 && star.y < y1)
      tft.drawPixel(star.x, star.y, star.color);
  }
}

void eraseOldSprites() {
  for (Bullet &bullet : bullets) {
    if (bullet.drawn)
      restoreBackground(bullet.drawX - 3, bullet.drawY - 8, 6, 12);
    bullet.drawn = false;
  }
  for (Enemy &enemy : enemies) {
    if (enemy.drawn)
      restoreBackground(enemy.drawX - 14, enemy.drawY - 10, 28, 20);
    enemy.drawn = false;
  }
  restoreBackground(drawnPlayerX - 18, PLAYER_Y - 16, 36, 28);
}

void drawSprites() {
  for (Bullet &bullet : bullets) {
    if (bullet.active && bullet.y >= 32) {
      tft.fillRoundRect(bullet.x - 2, bullet.y - 7, 4, 10, 2, TFT_YELLOW);
      bullet.drawX = bullet.x;
      bullet.drawY = bullet.y;
      bullet.drawn = true;
    }
  }
  for (Enemy &enemy : enemies) {
    if (enemy.y >= 40 && enemy.y < SCREEN_HEIGHT + 10) {
      tft.fillRoundRect(enemy.x - 11, enemy.y - 7, 22, 14, 5, TFT_RED);
      tft.fillCircle(enemy.x - 5, enemy.y - 1, 2, TFT_WHITE);
      tft.fillCircle(enemy.x + 5, enemy.y - 1, 2, TFT_WHITE);
      enemy.drawX = enemy.x;
      enemy.drawY = enemy.y;
      enemy.drawn = true;
    }
  }
  tft.fillTriangle(playerX, PLAYER_Y - 15, playerX - 12, PLAYER_Y + 8,
                   playerX + 12, PLAYER_Y + 8, TFT_CYAN);
  tft.fillTriangle(playerX - 7, PLAYER_Y + 2, playerX - 17, PLAYER_Y + 11,
                   playerX + 17, PLAYER_Y + 11, TFT_BLUE);
  drawnPlayerX = playerX;
}

void drawGameOver() {
  tft.fillRoundRect(35, 83, SCREEN_WIDTH - 70, 72, 8, TFT_BLACK);
  tft.setTextDatum(MC_DATUM);
  tft.setTextColor(TFT_RED, TFT_BLACK);
  tft.drawString("GAME OVER", SCREEN_WIDTH / 2, 108, 4);
  tft.setTextColor(TFT_YELLOW, TFT_BLACK);
  tft.drawString("BOOT/cham de choi lai", SCREEN_WIDTH / 2, 136, 2);
}

void handleButton(uint32_t now) {
  const bool reading = digitalRead(BUTTON_PIN);
  if (reading != lastButtonReading) lastDebounce = now;
  if (now - lastDebounce > 35 && reading != stableButtonState) {
    stableButtonState = reading;
    if (stableButtonState == LOW) toggleGame();
  }
  lastButtonReading = reading;
}

void handleTouch() {
  const bool pressed = touch.touched();
  if (pressed && !touchWasPressed) toggleGame();
  touchWasPressed = pressed;
}

void updateGame(uint32_t now) {
  const int state = observeState();
  const int action = chooseAction(state);
  if (action == 1) playerX = max(12, playerX - 7);
  if (action == 2) playerX = min(SCREEN_WIDTH - 12, playerX + 7);
  int reward = 0;

  if (now - lastShot >= SHOT_MS) {
    for (Bullet &bullet : bullets) {
      if (!bullet.active) {
        bullet = {playerX, PLAYER_Y - 12, true};
        break;
      }
    }
    lastShot = now;
  }

  for (Bullet &bullet : bullets) {
    if (bullet.active && (bullet.y -= 7) < 0) bullet.active = false;
  }

  for (Enemy &enemy : enemies) {
    enemy.y += enemy.speed;
    if (enemy.y > SCREEN_HEIGHT) {
      spawnEnemy(enemy);
      reward -= 1;
      if (--score <= 0) {
        score = 0;
        gameState = GameState::GAME_OVER;
        screenNeedsDraw = true;
        break;
      }
    }
  }

  if (gameState == GameState::PLAYING) {
    for (Bullet &bullet : bullets) {
      if (!bullet.active) continue;
      for (Enemy &enemy : enemies) {
        if (enemy.y >= 40 && abs(bullet.x - enemy.x) < 14 &&
            abs(bullet.y - enemy.y) < 13) {
          bullet.active = false;
          ++score;
          ++reward;
          spawnEnemy(enemy);
          break;
        }
      }
    }
  }
  learn(state, action, reward, observeState(), gameState == GameState::GAME_OVER);
}
}  // namespace

void setup() {
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(TOUCH_CS, OUTPUT);
  digitalWrite(TOUCH_CS, HIGH);
  SPI.begin(14, 12, 13, TOUCH_CS);
  tft.init();
  tft.setRotation(1);
  touch.begin();
  touch.setRotation(1);
  randomSeed(micros());
  drawIdleScreen();
}

void loop() {
  const uint32_t now = millis();
  handleButton(now);
  handleTouch();

  if (gameState == GameState::PLAYING && now - lastFrame >= FRAME_MS) {
    lastFrame = now;
    eraseOldSprites();
    updateGame(now);
    drawHud();
    drawSprites();
    if (gameState == GameState::GAME_OVER) {
      drawGameOver();
      screenNeedsDraw = false;
    }
  } else if (gameState == GameState::OFF && screenNeedsDraw) {
    drawIdleScreen();
    screenNeedsDraw = false;
  }
}
