# Game máy bay AI tự học cho ESP32

Game tự chơi trên ESP32. AI điều khiển máy bay, tự bắn và học bằng Q-learning: bắn trúng mục tiêu được +1 điểm; để mục tiêu bay qua mất bị -1 điểm. Bắt đầu với 3 điểm, điểm về 0 thì game over. Bảng Q giữ trong RAM và tiếp tục học qua các ván cho đến khi board khởi động lại.

## Chạy trên Wokwi

1. Tạo project ESP32 mới trong Wokwi.
2. Sao chép `wokwi/diagram.json` vào file `diagram.json`.
3. Sao chép `wokwi/sketch.ino` vào `sketch.ino` và `wokwi/libraries.txt` vào `libraries.txt`.
4. Tạo file `secrets.h` trong Wokwi bằng nội dung `wokwi/secrets.example.h`; tạo Gemini API key trong [Google AI Studio](https://aistudio.google.com/apikey) và thay giá trị `GEMINI_API_KEY`.
5. Chạy mô phỏng. Không cần joystick.

| ILI9341 / nút | ESP32 |
|---|---:|
| SCK | GPIO 18 |
| MOSI | GPIO 23 |
| MISO | GPIO 19 |
| CS | GPIO 5 |
| DC | GPIO 2 |
| VCC / GND | 3V3 / GND |
| Nút BOOT | GPIO 0 nối GND |

Nhấn nút để bắt đầu; nhấn trong game để dừng; nhấn lại để mở ván mới. ESP32 gửi trạng thái game tới `gemini-flash-lite-latest` mỗi 20 giây trên một FreeRTOS task riêng. Trên màn hình, `G:ON` là Gemini đã kết nối, `G:NET` đang kết nối, `G:ERR` là lần gọi gần nhất lỗi, `G:OFF` là chưa cấu hình key. Trong khi chờ mạng, máy bay vẫn chạy bằng Q-learning cục bộ; không gọi API theo từng khung hình. Màn hình gom các lệnh SPI của một khung hình và chỉ cập nhật vùng game, không xóa cả màn hình khi đang chơi.

Nếu chưa tạo `secrets.h`, code vẫn chạy với Q-learning cục bộ và hiển thị `G:OFF`. Khi API lỗi hoặc hết quota, game tiếp tục tự chơi cục bộ. Log Wi-Fi/Gemini nằm trong Serial Monitor ở 115200 baud.

**Bảo mật:** `secrets.h` bị Git bỏ qua. Không đưa API key vào file công khai hoặc project Wokwi công khai; key trên ESP32 vẫn có thể bị trích xuất. Bản này phù hợp thử nghiệm; sản phẩm triển khai cho người khác nên gọi một backend riêng giữ key thay vì nhúng key trong thiết bị.

## Chạy trên ESP32-2432S028R (CYD)

Mở `esp32-airplane-game.ino`, cài thư viện `TFT_eSPI` và `XPT2046_Touchscreen`, chọn board ESP32 và nạp chương trình. Màn hình cảm ứng CYD đã nối sẵn:

| Thiết bị | Chân ESP32 |
|---|---:|
| ILI9341 SCLK / MOSI / MISO | GPIO 14 / 13 / 12 |
| ILI9341 CS / DC | GPIO 15 / 2 |
| XPT2046 CS | GPIO 33 |
| Nút BOOT (nhấn nối GND) | GPIO 0 |

Trong `TFT_eSPI/User_Setup.h`, chọn driver ILI9341 và các chân theo bảng trên (`TFT_WIDTH 240`, `TFT_HEIGHT 320`, `TFT_RST -1`). Chạm màn hình hoặc nhấn BOOT để bật/dừng/chơi lại; AI vẫn tự điều khiển máy bay.

GPIO 0 là chân boot strap; không giữ nút BOOT khi cấp nguồn nếu không muốn vào chế độ nạp.

Q-learning ở đây là mô hình nhỏ chạy trực tiếp trên ESP32, không phải mạng neuron. Bảng học chiếm khoảng 650 byte RAM, mất khi khởi động lại. Trong sketch Wokwi, Gemini là AI chiến thuật trực tuyến; Q-learning làm phương án dự phòng cục bộ.
