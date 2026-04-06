export const metadata = {
  title: 'StockFlow',
  description: 'Sistema de controle de estoque multisetorial',
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f5f7f4' }}>
        {children}
      </body>
    </html>
  )
}
