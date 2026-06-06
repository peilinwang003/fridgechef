export const metadata = {
  title: "FridgeChef · What can I cook tonight?",
  description: "Toss in whatever you've got and get three recipes you can make right now.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
