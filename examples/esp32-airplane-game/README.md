# Game máy bay bắn mục tiêu cho ESP32

Game Arduino cho màn hình cảm ứng ILI9341 320×240 dùng bộ điều khiển cảm ứng XPT2046 (ví dụ ESP32-2432S028R/CYD). Chạm hoặc kéo để di chuyển máy bay; máy bay tự bắn. Bắn trúng mục tiêu để ghi điểm, né mục tiêu để giữ 3 mạng.

## Nối dây mẫu

| Thiết bị | ESP32 |
|---|---:|
| ILI9341 SCLK / MOSI / MISO | GPIO 14 / 13 / 12 |
| ILI9341 CS / DC | GPIO 15 / 2 |
| XPT2046 CS | GPIO 33 |
| Nút BOOT (nhấn nối GND) | GPIO 0 |
| GND | GND |

Trên CYD, màn hình và cảm ứng thường đã được nối sẵn. Nút BOOT chỉ bật/tắt game, không ngắt nguồn ESP32; nhấn nút khi đang chơi sẽ về màn hình chờ, nhấn lại để bắt đầu ván mới. Không giữ GPIO 0 xuống GND khi cấp nguồn vì có thể đưa ESP32 vào chế độ nạp.

## Cài đặt và chạy

1. Cài Arduino IDE, thêm board **ESP32 by Espressif Systems**.
2. Cài thư viện **TFT_eSPI** và **XPT2046_Touchscreen** trong Library Manager.
3. Trong `TFT_eSPI/User_Setup.h`, cấu hình driver ILI9341 và chân màn hình:

   ```cpp
   #define ILI9341_DRIVER
   #define TFT_WIDTH  240
   #define TFT_HEIGHT 320
   #define TFT_MISO 12
   #define TFT_MOSI 13
   #define TFT_SCLK 14
   #define TFT_CS   15
   #define TFT_DC    2
   #define TFT_RST  -1
   ```

4. Mở `esp32-airplane-game.ino`, chọn board ESP32 phù hợp và nạp chương trình.

Các chân cảm ứng mẫu là CS 33 và dùng chung SPI. Nếu dùng board khác, sửa chân trong sketch và cấu hình TFT_eSPI cho đúng sơ đồ chân thực tế. Nếu hướng chạm bị ngược hoặc lệch, chỉnh `TOUCH_MIN`/`TOUCH_MAX` hoặc đảo hai giá trị đầu-cuối trong lệnh `map()` tại `handleTouch()`.
