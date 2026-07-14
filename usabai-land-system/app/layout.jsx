import "./globals.css";

export const metadata = {
  title: "U-Sabai Land and House — ລະບົບຄຸ້ມຄອງດິນຈັດສັນ",
  description: "ລະບົບຄຸ້ມຄອງການພັດທະນາ ການຂາຍ ແລະ ການຊຳລະເງິນ",
};

export default function RootLayout({ children }) {
  return (
    <html lang="lo">
      <body>{children}</body>
    </html>
  );
}
