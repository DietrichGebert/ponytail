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
constexpr uint32_t FRAME_MS = 40;
constexpr uint32_t SHOT_MS = 220;
constexpr int TOUCH_MIN = 300;
constexpr int TOUCH_MAX = 3700;

TFT_eSPI tft;
XPT2046_Touchscreen touch(TOUCH_CS);

struct Enemy {
  int x;
  int y;
  int speed;
};

struct Bullet {
  int x;
  int y;
  bool active;
};

enum class GameState { OFF, PLAYING, GAME_OVER };

Enemy enemies[ENEMY_COUNT];
Bullet bullets[BULLET_COUNT];
GameState gameState = GameState::OFF;
int playerX = SCREEN_WIDTH / 2;
int score = 0;
int lives = 3;
uint32_t lastFrame = 0;
uint32_t lastShot = 0;
uint32_t lastDebounce = 0;
bool lastButtonReading = HIGH;
bool stableButtonState = HIGH;
bool screenNeedsDraw = true;

void spawnEnemy(Enemy &enemy) {
  enemy.x = random(18, SCREEN_WIDTH - 18);
  enemy.y = random(-150, -20);
  enemy.speed = random(2, 5);
}

void resetGame() {
  score = 0;
  lives = 3;
  playerX = SCREEN_WIDTH / 2;
  for (Enemy &enemy : enemies) spawnEnemy(enemy);
  for (Bullet &bullet : bullets) bullet.active = false;
  lastShot = millis();
  screenNeedsDraw = true;
}

void drawIdleScreen() {
  tft.fillScreen(TFT_NAVY);
  tft.setTextColor(TFT_WHITE, TFT_NAVY);
  tft.setTextDatum(MC_DATUM);
  tft.drawString("MAY BAY", SCREEN_WIDTH / 2, 68, 4);
  tft.setTextColor(TFT_CYAN, TFT_NAVY);
  tft.drawString("Cham de di chuyen - may bay tu ban", SCREEN_WIDTH / 2, 116, 2);
  tft.setTextColor(TFT_YELLOW, TFT_NAVY);
  tft.drawString("Nhan nut BOOT de bat dau", SCREEN_WIDTH / 2, 158, 2);
  tft.setTextColor(TFT_LIGHTGREY, TFT_NAVY);
  tft.drawString("Nut BOOT: bat / tat / choi lai", SCREEN_WIDTH / 2, 190, 1);
}

void drawGame() {
  tft.fillScreen(TFT_NAVY);
  for (int i = 0; i < 22; ++i) {
    const int x = (i * 73 + 17) % SCREEN_WIDTH;
    const int y = (i * 47 + 11) % SCREEN_HEIGHT;
    tft.drawPixel(x, y, (i % 3 == 0) ? TFT_CYAN : TFT_DARKGREY);
  }

  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(TFT_WHITE, TFT_NAVY);
  tft.drawString("DIEM " + String(score), 8, 6, 2);
  tft.drawString("MANG " + String(lives), SCREEN_WIDTH - 76, 6, 2);

  for (const Bullet &bullet : bullets) {
    if (bullet.active) tft.fillRoundRect(bullet.x - 2, bullet.y - 7, 4, 10, 2, TFT_YELLOW);
  }
  for (const Enemy &enemy : enemies) {
    tft.fillRoundRect(enemy.x - 11, enemy.y - 7, 22, 14, 5, TFT_RED);
    tft.fillCircle(enemy.x - 5, enemy.y - 1, 2, TFT_WHITE);
    tft.fillCircle(enemy.x + 5, enemy.y - 1, 2, TFT_WHITE);
  }
  tft.fillTriangle(playerX, PLAYER_Y - 15, playerX - 12, PLAYER_Y + 8,
                   playerX + 12, PLAYER_Y + 8, TFT_CYAN);
  tft.fillTriangle(playerX - 7, PLAYER_Y + 2, playerX - 17, PLAYER_Y + 11,
                   playerX + 17, PLAYER_Y + 11, TFT_BLUE);

  if (gameState == GameState::GAME_OVER) {
    tft.fillRoundRect(35, 83, SCREEN_WIDTH - 70, 72, 8, TFT_BLACK);
    tft.setTextDatum(MC_DATUM);
    tft.setTextColor(TFT_RED, TFT_BLACK);
    tft.drawString("GAME OVER", SCREEN_WIDTH / 2, 108, 4);
    tft.setTextColor(TFT_YELLOW, TFT_BLACK);
    tft.drawString("Nhan nut BOOT de choi lai", SCREEN_WIDTH / 2, 136, 2);
  }
}

void handleButton(uint32_t now) {
  const bool reading = digitalRead(BUTTON_PIN);
  if (reading != lastButtonReading) lastDebounce = now;
  if (now - lastDebounce > 35 && reading != stableButtonState) {
    stableButtonState = reading;
    if (stableButtonState == LOW) {
      if (gameState == GameState::GAME_OVER) {
        gameState = GameState::PLAYING;
        resetGame();
      } else if (gameState == GameState::OFF) {
        gameState = GameState::PLAYING;
        resetGame();
      } else {
        gameState = GameState::OFF;
        screenNeedsDraw = true;
      }
    }
  }
  lastButtonReading = reading;
}

void handleTouch() {
  if (!touch.touched()) return;
  const TS_Point point = touch.getPoint();
  if (point.z < 100) return;

  // On the sample landscape wiring, touch Y is the horizontal screen axis.
  const int x = map(point.y, TOUCH_MIN, TOUCH_MAX, 0, SCREEN_WIDTH - 1);
  playerX = constrain(x, 12, SCREEN_WIDTH - 12);
}

void updateGame(uint32_t now) {
  handleTouch();

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
      if (--lives <= 0) {
        gameState = GameState::GAME_OVER;
        screenNeedsDraw = true;
        break;
      }
    }
  }

  if (gameState != GameState::PLAYING) return;
  for (Bullet &bullet : bullets) {
    if (!bullet.active) continue;
    for (Enemy &enemy : enemies) {
      if (abs(bullet.x - enemy.x) < 14 && abs(bullet.y - enemy.y) < 13) {
        bullet.active = false;
        score += 10;
        spawnEnemy(enemy);
        break;
      }
    }
  }
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

  if (gameState == GameState::PLAYING && now - lastFrame >= FRAME_MS) {
    lastFrame = now;
    updateGame(now);
    drawGame();
  } else if (gameState != GameState::PLAYING && screenNeedsDraw) {
    if (gameState == GameState::OFF) drawIdleScreen();
    else drawGame();
    screenNeedsDraw = false;
  }
}
