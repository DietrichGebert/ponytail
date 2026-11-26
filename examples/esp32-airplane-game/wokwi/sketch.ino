#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ILI9341.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <string.h>

static const char GOOGLE_ROOT_CA[] PROGMEM = R"PEM(
-----BEGIN CERTIFICATE-----
MIIFVzCCAz+gAwIBAgINAgPlk28xsBNJiGuiFzANBgkqhkiG9w0BAQwFADBHMQsw
CQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2VzIExMQzEU
MBIGA1UEAxMLR1RTIFJvb3QgUjEwHhcNMTYwNjIyMDAwMDAwWhcNMzYwNjIyMDAw
MDAwWjBHMQswCQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZp
Y2VzIExMQzEUMBIGA1UEAxMLR1RTIFJvb3QgUjEwggIiMA0GCSqGSIb3DQEBAQUA
A4ICDwAwggIKAoICAQC2EQKLHuOhd5s73L+UPreVp0A8of2C+X0yBoJx9vaMf/vo
27xqLpeXo4xL+Sv2sfnOhB2x+cWX3u+58qPpvBKJXqeqUqv4IyfLpLGcY9vXmX7w
Cl7raKb0xlpHDU0QM+NOsROjyBhsS+z8CZDfnWQpJSMHobTSPS5g4M/SCYe7zUjw
TcLCeoiKu7rPWRnWr4+wB7CeMfGCwcDfLqZtbBkOtdh+JhpFAz2weaSUKK0Pfybl
qAj+lug8aJRT7oM6iCsVlgmy4HqMLnXWnOunVmSPlk9orj2XwoSPwLxAwAtcvfaH
szVsrBhQf4TgTM2S0yDpM7xSma8ytSmzJSq0SPly4cpk9+aCEI3oncKKiPo4Zor8
Y/kB+Xj9e1x3+naH+uzfsQ55lVe0vSbv1gHR6xYKu44LtcXFilWr06zqkUspzBmk
MiVOKvFlRNACzqrOSbTqn3yDsEB750Orp2yjj32JgfpMpf/VjsPOS+C12LOORc92
wO1AK/1TD7Cn1TsNsYqiA94xrcx36m97PtbfkSIS5r762DL8EGMUUXLeXdYWk70p
aDPvOmbsB4om3xPXV2V4J95eSRQAogB/mqghtqmxlbCluQ0WEdrHbEg8QOB+DVrN
VjzRlwW5y0vtOUucxD/SVRNuJLDWcfr0wbrM7Rv1/oFB2ACYPTrIrnqYNxgFlQID
AQABo0IwQDAOBgNVHQ8BAf8EBAMCAYYwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4E
FgQU5K8rJnEaK0gnhS9SZizv8IkTcT4wDQYJKoZIhvcNAQEMBQADggIBAJ+qQibb
C5u+/x6Wki4+omVKapi6Ist9wTrYggoGxval3sBOh2Z5ofmmWJyq+bXmYOfg6LEe
QkEzCzc9zolwFcq1JKjPa7XSQCGYzyI0zzvFIoTgxQ6KfF2I5DUkzps+GlQebtuy
h6f88/qBVRRiClmpIgUxPoLW7ttXNLwzldMXG+gnoot7TiYaelpkttGsN/H9oPM4
7HLwEXWdyzRSjeZ2axfG34arJ45JK3VmgRAhpuo+9K4l/3wV3s6MJT/KYnAK9y8J
ZgfIPxz88NtFMN9iiMG1D53Dn0reWVlHxYciNuaCp+0KueIHoI17eko8cdLiA6Ef
MgfdG+RCzgwARWGAtQsgWSl4vflVy2PFPEz0tv/bal8xa5meLMFrUKTX5hgUvYU/
Z6tGn6D/Qqc6f1zLXbBwHSs09dR2CQzreExZBfMzQsNhFRAbd03OIozUhfJFfbdT
6u9AWpQKXCBfTkBdYiJ23//OYb2MI3jSNwLgjt7RETeJ9r/tSQdirpLsQBqvFAnZ
0E6yove+7u7Y/9waLd64NnHi/Hm3lCXRSHNboTXns5lndcEZOitHTtNCjv0xyBZm
2tIMPNuzjsmhDYAPexZ3FL//2wmUspO8IFgV6dtxQ/PeEMMA3KgqlbbC1j+Qa3bb
bP6MvPJwNQzcmRk13NfIRmPVNnGuV/u3gm3c
-----END CERTIFICATE-----
)PEM";

constexpr int TFT_CS = 5, TFT_DC = 2, BUTTON_PIN = 0;
constexpr int SCREEN_W = 320, SCREEN_H = 240, PLAYER_Y = 205;
constexpr int ENEMY_COUNT = 5, BULLET_COUNT = 5, STAR_COUNT = 22;
constexpr int PLAYER_BINS = 6, DX_BINS = 3, DISTANCE_BINS = 3;
constexpr int ACTION_COUNT = 3;
constexpr int STATE_COUNT = PLAYER_BINS * DX_BINS * DISTANCE_BINS;
constexpr uint32_t FRAME_MS = 40, SHOT_MS = 220;
constexpr uint32_t GEMINI_INTERVAL_MS = 20000, GEMINI_ACTION_MS = 25000;
constexpr float LEARNING_RATE = 0.2f, DISCOUNT_RATE = 0.85f;
static_assert(STATE_COUNT == 54, "Q table state count must match the observation bins");

#if __has_include("secrets.h")
#include "secrets.h"
#else
#define GEMINI_API_KEY ""
#define WIFI_SSID "Wokwi-GUEST"
#define WIFI_PASSWORD ""
#endif

Adafruit_ILI9341 tft(TFT_CS, TFT_DC);
enum GameState { OFF, PLAYING, GAME_OVER };
struct Enemy { int x, y, speed, drawX, drawY; bool drawn; };
struct Bullet { int x, y, drawX, drawY; bool active, drawn; };
struct Star { int x, y; uint16_t color; };

Enemy enemies[ENEMY_COUNT];
Bullet bullets[BULLET_COUNT];
Star stars[STAR_COUNT];
float qValues[STATE_COUNT][ACTION_COUNT] = {};
volatile GameState gameState = OFF;
int playerX = SCREEN_W / 2, drawnPlayerX = SCREEN_W / 2;
volatile int score = 3;
int shownScore = -1;
uint32_t learningSteps = 0, shownLearning = UINT32_MAX;
uint32_t lastFrame = 0, lastShot = 0, lastDebounce = 0;
bool lastReading = HIGH, buttonState = HIGH;
volatile int geminiAction = -1;
volatile uint32_t geminiActionAt = 0;
volatile int aiPlayerX = SCREEN_W / 2, aiTargetX = SCREEN_W / 2, aiTargetY = 0;
volatile int geminiStatus = 0;
int shownGeminiStatus = -1;

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

const char *geminiStatusLabel() {
  switch (geminiStatus) {
    case 1: return "NET";
    case 2: return "ON";
    case 3: return "ERR";
    default: return "OFF";
  }
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
  if (force || geminiStatus != shownGeminiStatus) {
    tft.fillRect(112, 0, 94, 28, ILI9341_BLACK);
    tft.setTextSize(2); tft.setTextColor(geminiStatus == 2 ? ILI9341_GREEN : ILI9341_YELLOW);
    tft.setCursor(116, 7); tft.print("G:"); tft.print(geminiStatusLabel());
    shownGeminiStatus = geminiStatus;
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
  int action = chooseAction(state);
  if (geminiAction >= 0 && now - static_cast<uint32_t>(geminiActionAt) < GEMINI_ACTION_MS)
    action = geminiAction;
  if (action == 1) playerX = max(12, playerX - 7);
  if (action == 2) playerX = min(SCREEN_W - 12, playerX + 7);
  aiPlayerX = playerX;
  const Enemy *target = &enemies[0];
  for (const Enemy &enemy : enemies) {
    if (enemy.y > target->y) target = &enemy;
  }
  aiTargetX = target->x;
  aiTargetY = target->y;
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

bool askGemini(int player, int target, int targetY, int currentScore, int &action) {
  WiFiClientSecure client;
  client.setCACert(GOOGLE_ROOT_CA);
  HTTPClient https;
  https.setTimeout(5000);
  if (!https.begin(client, "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent")) {
    Serial.println("Gemini: HTTPS connection setup failed.");
    return false;
  }
  https.addHeader("Content-Type", "application/json");
  https.addHeader("x-goog-api-key", GEMINI_API_KEY);

  JsonDocument request;
  request["contents"][0]["parts"][0]["text"] =
      "You control a tiny airplane game. Choose the next horizontal action to align with the target and survive. "
      "Return only JSON {\"action\":\"LEFT\"}, {\"action\":\"RIGHT\"}, or {\"action\":\"STAY\"}. "
      "Current plane x=" + String(player) + ", target x=" + String(target) +
      ", target y=" + String(targetY) + ", score=" + String(currentScore) +
      ". Screen x range is 12 to 308. A target closer to y=240 is urgent.";
  request["generationConfig"]["responseMimeType"] = "application/json";
  request["generationConfig"]["responseSchema"]["type"] = "OBJECT";
  request["generationConfig"]["responseSchema"]["properties"]["action"]["type"] = "STRING";
  JsonArray allowed = request["generationConfig"]["responseSchema"]["properties"]["action"]["enum"].to<JsonArray>();
  allowed.add("LEFT");
  allowed.add("RIGHT");
  allowed.add("STAY");
  request["generationConfig"]["responseSchema"]["required"][0] = "action";
  request["generationConfig"]["maxOutputTokens"] = 20;

  String body;
  serializeJson(request, body);
  const int status = https.POST(body);
  if (status != HTTP_CODE_OK) {
    Serial.printf("Gemini HTTP error: %d\n", status);
    https.end();
    return false;
  }

  JsonDocument response;
  const String responseBody = https.getString();
  https.end();
  const DeserializationError error = deserializeJson(response, responseBody);
  if (error) {
    Serial.printf("Gemini response JSON error: %s\n", error.c_str());
    return false;
  }

  const char *answer = response["candidates"][0]["content"]["parts"][0]["text"];
  if (!answer) {
    Serial.println("Gemini response did not contain candidate text.");
    return false;
  }
  JsonDocument decision;
  if (deserializeJson(decision, answer)) {
    Serial.println("Gemini action was not valid JSON.");
    return false;
  }
  const char *choice = decision["action"];
  if (!choice) {
    Serial.println("Gemini response did not contain an action.");
    return false;
  }
  if (strcmp(choice, "LEFT") == 0) action = 1;
  else if (strcmp(choice, "STAY") == 0) action = 0;
  else if (strcmp(choice, "RIGHT") == 0) action = 2;
  else {
    Serial.println("Gemini returned an unsupported action.");
    return false;
  }
  return true;
}

void geminiTask(void *) {
  if (!GEMINI_API_KEY[0] || strcmp(GEMINI_API_KEY, "paste-your-gemini-api-key-here") == 0) {
    geminiStatus = 0;
    Serial.println("Gemini disabled: add a valid key to secrets.h.");
    vTaskDelete(nullptr);
    return;
  }

  geminiStatus = 1;
  WiFi.mode(WIFI_STA);
  uint32_t lastRequest = millis() - GEMINI_INTERVAL_MS;
  for (;;) {
    if (WiFi.status() != WL_CONNECTED) {
      geminiStatus = 1;
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD, 6);
      for (int attempt = 0; attempt < 40 && WiFi.status() != WL_CONNECTED; ++attempt)
        vTaskDelay(pdMS_TO_TICKS(250));
      if (WiFi.status() != WL_CONNECTED) {
        geminiStatus = 3;
        Serial.println("Gemini unavailable: Wi-Fi connection failed; retrying.");
        vTaskDelay(pdMS_TO_TICKS(10000));
        continue;
      }
      geminiStatus = 2;
      Serial.println("Wi-Fi connected; Gemini pilot enabled.");
    }

    if (gameState != PLAYING || millis() - lastRequest < GEMINI_INTERVAL_MS) {
      vTaskDelay(pdMS_TO_TICKS(250));
      continue;
    }

    lastRequest = millis();
    int action = -1;
    if (askGemini(aiPlayerX, aiTargetX, aiTargetY, score, action)) {
      geminiAction = action;
      geminiActionAt = millis();
      geminiStatus = 2;
      Serial.printf("Gemini action: %s\n", action == 1 ? "LEFT" : action == 2 ? "RIGHT" : "STAY");
    } else {
      geminiStatus = 3;
      Serial.println("Gemini request failed; local Q-learning pilot remains active.");
    }
    vTaskDelay(pdMS_TO_TICKS(250));
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  randomSeed(micros());
  SPI.begin(18, 19, 23, TFT_CS);
  tft.begin();
  tft.setRotation(1);
  drawIdle();
  xTaskCreatePinnedToCore(geminiTask, "GeminiPilot", 8192, nullptr, 1, nullptr, 0);
}

void loop() {
  const uint32_t now = millis();
  handleButton(now);
  if (gameState != PLAYING || now - lastFrame < FRAME_MS) return;
  lastFrame = now;
  tft.startWrite();
  eraseOldSprites();
  updateGame(now);
  drawHud();
  drawSprites();
  if (gameState == GAME_OVER) drawGameOver();
  tft.endWrite();
}
