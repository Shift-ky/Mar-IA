import './globals.css';
import './responsive.css';
export const metadata={title:'Mar IA • Finanças da família',description:'Seu dinheiro, seus planos, com ou sem internet.',manifest:'/manifest.webmanifest',icons:{icon:'/brand/mar-app-icon.png',apple:'/brand/mar-app-icon.png'}};
export const viewport={themeColor:'#0A1E3A',colorScheme:'light dark'};
const themeBootstrap="(()=>{try{const media=matchMedia('(prefers-color-scheme: light)'),apply=()=>{const preference=localStorage.getItem('mar-ia-theme')||'automatico';document.documentElement.dataset.theme=preference==='automatico'?(media.matches?'claro':'escuro'):(['claro','escuro'].includes(preference)?preference:'escuro')};apply();media.addEventListener('change',apply)}catch{document.documentElement.dataset.theme='escuro'}})();";
export default function Layout({children}:{children:React.ReactNode}){return <html lang="pt-BR" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:themeBootstrap}}/></head><body>{children}</body></html>}
