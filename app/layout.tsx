import './globals.css';
export const metadata={title:'Mar IA • Finanças da família',description:'Seu dinheiro, seus planos, com ou sem internet.',manifest:'/manifest.webmanifest',icons:{icon:'/brand/mar-app-icon.png',apple:'/brand/mar-app-icon.png'}};
export const viewport={themeColor:'#0A1E3A',colorScheme:'dark'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>}
