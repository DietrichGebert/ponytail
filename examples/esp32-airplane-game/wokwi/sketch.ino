#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ILI9341.h>

constexpr int TFT_CS = 5, TFT_DC = 2, BUTTON_PIN = 0;
constexpr int SCREEN_W = 320, SCREEN_H = 240, PLAYER_Y = 205;
constexpr int ENEMY_COUNT = 5, BULLET_COUNT = 5, STAR_COUNT = 22;
constexpr int PLAYER_BINS = 6, DX_BINS = 3, DISTANCE_BINS = 3;
constexpr int ACTION_COUNT = 3;
constexpr int STATE_COUNT = PLAYER_BINS * DX_BINS * DISTANCE_BINS;
constexpr uint32_t FRAME_MS = 40, SHOT_MS = 220;
constexpr float LEARNING_RATE = 0.2f, DISCOUNT_RATE = 0.85f;
static_assert(STATE_COUNT == 54, "Q table state count must match the observation bins");

Adafruit_ILI9341 tft(TFT_CS, TFT_DC);
enum GameState { OFF, PLAYING, GAME_OVER };
struct Enemy { int x, y, speed, drawX, drawY; bool drawn; };
struct Bullet { int x, y, drawX, drawY; bool active, drawn; };
struct Star { int x, y; uint16_t color; };

Enemy enemies[ENEMY_COUNT];
Bullet bullets[BULLET_COUNT];
Star stars[STAR_COUNT];
float qValues[STATE_COUNT][ACTION_COUNT] = {};
GameState gameState = OFF;
int playerX = SCREEN_W / 2, drawnPlayerX = SCREEN_W / 2;
int score = 3, shownScore = -1;
uint32_t learningSteps = 0, shownLearning = UINT32_MAX;
uint32_t lastFrame = 0, lastShot = 0, lastDebounce = 0;
bool lastReading = HIGH, buttonState = HIGH;

void spawnEnemy(Enemy &enemy) {
  enemy.x = random(18, SCREEN_W - 18);
  enemy.y = random(-160, -40);
  enemy.speed = random(2, 5);
  enemy.drawn = false;
}

int observeState() {
  const Enemy *target = &enemies[0];
  for (const Enemy &enemy : enemies) {
    if (enemy.y > target->y) target = &enemy;
  }
  const int playerBin = constrain(playerX * PLAYER_BINS / SCREEN_W, 0, PLAYER_BINS - 1);
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

void restoreBackground(int x, int y, int width, int height) {
  const int x0 = max(0, x), y0 = max(30, y);
  const int x1 = min(SCREEN_W, x + width), y1 = min(SCREEN_H, y + height);
  if (x0 >= x1 || y0 >= y1) return;
  tft.fillRect(x0, y0, x1 - x0, y1 - y0, ILI9341_NAVY);
  for (const Star &star : stars) {
    if (star.x >= x0 && star.x < x1 && star.y >= y0 && star.y < y1)
      tft.drawPixel(star.x, star.y, star.color);
  }
}

void drawStars() {
  for (Star &star : stars) {
    star.x = random(2, SCREEN_W - 2);
    star.y = random(34, SCREEN_H - 2);
    star.color = random(0, 3) == 0 ? ILI9341_CYAN : ILI9341_DARKGREY;
    tft.drawPixel(star.x, star.y, star.color);
  }
}

void drawIdle() {
  tft.fillScreen(ILI9341_NAVY);
  tft.setTextColor(ILI9341_WHITE);
  tft.setTextSize(3);
  tft.setCursor(75, 65); tft.print("MAY BAY");
  tft.setTextSize(2);
  tft.setTextColor(ILI9341_CYAN);
  tft.setCursor(25, 115); tft.print("AI tu hoc, tu ban");
  tft.setTextColor(ILI9341_YELLOW);
  tft.setCursor(25, 155); tft.print("Nhan nut BOOT de choi");
}

void drawHud(bool force = false) {
  if (force || score != shownScore) {
    tft.fillRect(0, 0, 105, 28, ILI9341_BLACK);
    tft.setTextSize(2); tft.setTextColor(ILI9341_WHITE); tft.setCursor(6, 7);
    tft.print("DIEM "); tft.print(score);
    shownScore = score;
  }
  const uint32_t learnDisplay = learningSteps / 100;
  if (force || learnDisplay != shownLearning) {
    tft.fillRect(218, 0, 102, 28, ILI9341_BLACK);
    tft.setTextSize(2); tft.setTextColor(ILI9341_CYAN); tft.setCursor(222, 7);
    tft.print("HOC "); tft.print(learnDisplay);
    shownLearning = learnDisplay;
  }
}

void startGame() {
  score = 3;
  shownScore = -1;
  shownLearning = UINT32_MAX;
  playerX = drawnPlayerX = SCREEN_W / 2;
  tft.fillScreen(ILI9341_NAVY);
  drawStars();
  drawHud(true);
  for (Enemy &enemy : enemies) spawnEnemy(enemy);
  for (Bullet &bullet : bullets) {
    bullet.active = false;
    bullet.drawn = false;
  }
  lastShot = millis();
  gameState = PLAYING;
}

void toggleGame() {
  if (gameState == PLAYING) {
    gameState = OFF;
    drawIdle();
  } else {
    startGame();
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
    if (bullet.active && bullet.y >= 30) {
      tft.fillRoundRect(bullet.x - 2, bullet.y - 7, 4, 10, 2, ILI9341_YELLOW);
      bullet.drawX = bullet.x; bullet.drawY = bullet.y; bullet.drawn = true;
    }
  }
  for (Enemy &enemy : enemies) {
    if (enemy.y >= 40 && enemy.y < SCREEN_H + 10) {
      tft.fillRoundRect(enemy.x - 11, enemy.y - 7, 22, 14, 5, ILI9341_RED);
      tft.fillCircle(enemy.x - 5, enemy.y - 1, 2, ILI9341_WHITE);
      tft.fillCircle(enemy.x + 5, enemy.y - 1, 2, ILI9341_WHITE);
      enemy.drawX = enemy.x; enemy.drawY = enemy.y; enemy.drawn = true;
    }
  }
  tft.fillTriangle(playerX, PLAYER_Y - 15, playerX - 12, PLAYER_Y + 8,
                   playerX + 12, PLAYER_Y + 8, ILI9341_CYAN);
  tft.fillTriangle(playerX - 7, PLAYER_Y + 2, playerX - 17, PLAYER_Y + 11,
                   playerX + 17, PLAYER_Y + 11, ILI9341_BLUE);
  drawnPlayerX = playerX;
}

void drawGameOver() {
  tft.fillRoundRect(35, 83, 250, 72, 8, ILI9341_BLACK);
  tft.setTextColor(ILI9341_RED); tft.setTextSize(3);
  tft.setCursor(78, 98); tft.print("GAME OVER");
  tft.setTextColor(ILI9341_YELLOW); tft.setTextSize(2);
  tft.setCursor(48, 132); tft.print("Nhan nut de choi lai");
}

void handleButton(uint32_t now) {
  const bool reading = digitalRead(BUTTON_PIN);
  if (reading != lastReading) lastDebounce = now;
  if (now - lastDebounce > 35 && reading != buttonState) {
    buttonState = reading;
    if (buttonState == LOW) toggleGame();
  }
  lastReading = reading;
}

void updateGame(uint32_t now) {
  const int state = observeState();
  const int action = chooseAction(state);
  if (action == 1) playerX = max(12, playerX - 7);
  if (action == 2) playerX = min(SCREEN_W - 12, playerX + 7);
  int reward = 0;

  if (now - lastShot >= SHOT_MS) {
    for (Bullet &bullet : bullets) {
      if (!bullet.active) {
        bullet.x = playerX; bullet.y = PLAYER_Y - 12; bullet.active = true;
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
    if (enemy.y > SCREEN_H) {
      spawnEnemy(enemy);
      reward -= 1;
      if (--score <= 0) {
        score = 0;
        gameState = GAME_OVER;
        break;
      }
    }
  }
  if (gameState == PLAYING) {
    for (Bullet &bullet : bullets) {
      if (!bullet.active) continue;
      for (Enemy &enemy : enemies) {
        if (enemy.y >= 40 && abs(bullet.x - enemy.x) < 14 &&
            abs(bullet.y - enemy.y) < 13) {
          bullet.active = false; ++score; ++reward; spawnEnemy(enemy); break;
        }
      }
    }
  }
  learn(state, action, reward, observeState(), gameState == GAME_OVER);
}

void setup() {
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  randomSeed(micros());
  SPI.begin(18, 19, 23, TFT_CS);
  tft.begin();
  tft.setRotation(1);
  drawIdle();
}

void loop() {
  const uint32_t now = millis();
  handleButton(now);
  if (gameState != PLAYING || now - lastFrame < FRAME_MS) return;
  lastFrame = now;
  eraseOldSprites();
  updateGame(now);
  drawHud();
  drawSprites();
  if (gameState == GAME_OVER) drawGameOver();
}
