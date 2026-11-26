# Game máy bay AI tự học cho ESP32

Game tự chơi trên ESP32. AI điều khiển máy bay, tự bắn và học bằng Q-learning: bắn trúng mục tiêu được +1 điểm; để mục tiêu bay qua mất bị -1 điểm. Bắt đầu với 3 điểm, điểm về 0 thì game over. Bảng Q giữ trong RAM và tiếp tục học qua các ván cho đến khi board khởi động lại.

## Chạy trên Wokwi

1. Tạo project ESP32 mới trong Wokwi.
2. Sao chép `wokwi/diagram.json` vào file `diagram.json`.
3. Sao chép `wokwi/sketch.ino` vào file `sketch.ino` và `wokwi/libraries.txt` vào file `libraries.txt`.
4. Chạy mô phỏng. Không cần joystick.

| ILI9341 / nút | ESP32 |
|---|---:|
| SCK | GPIO 18 |
| MOSI | GPIO 23 |
| MISO | GPIO 19 |
| CS | GPIO 5 |
| DC | GPIO 2 |
| VCC / GND | 3V3 / GND |
| Nút BOOT | GPIO 0 nối GND |

Nhấn nút để bắt đầu; nhấn trong game để dừng; nhấn lại để mở ván mới. Màn hình chỉ cập nhật các vùng vật thể di chuyển, không quét lại toàn bộ màn hình mỗi khung hình.

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

Q-learning ở đây là mô hình nhỏ chạy trực tiếp trên ESP32, không phải mạng neuron. Bảng học chiếm khoảng 650 byte RAM, mất khi khởi động lại; không cần kết nối mạng hay dịch vụ AI bên ngoài. AI có thể cần nhiều ván để tìm ra hành động tốt.
