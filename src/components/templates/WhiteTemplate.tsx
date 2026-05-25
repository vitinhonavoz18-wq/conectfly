import { BlackTemplate } from "./BlackTemplate";
import type { SiteData } from "@/lib/site/types";

// WhiteTemplate is a clean version of BlackTemplate
// We'll wrap it in a div with a class that overrides global styles or provides a theme context
export function WhiteTemplate({ data }: { data: SiteData }) {
  return (
    <div className="site-template-white min-h-screen bg-white text-slate-900">
      <style dangerouslySetInnerHTML={{ __html: `
        .site-template-white {
          --background: 0 0% 100%;
          --foreground: 222.2 84% 4.9%;
          --card: 0 0% 100%;
          --card-foreground: 222.2 84% 4.9%;
          --popover: 0 0% 100%;
          --popover-foreground: 222.2 84% 4.9%;
          --primary: 221.2 83.2% 53.3%;
          --primary-foreground: 210 40% 98%;
          --secondary: 210 40% 96.1%;
          --secondary-foreground: 222.2 47.4% 11.2%;
          --muted: 210 40% 96.1%;
          --muted-foreground: 215.4 16.3% 46.9%;
          --accent: 210 40% 96.1%;
          --accent-foreground: 222.2 47.4% 11.2%;
          --border: 214.3 31.8% 91.4%;
          --input: 214.3 31.8% 91.4%;
          --ring: 221.2 83.2% 53.3%;
        }
        .site-template-white .card-premium {
          background: white;
          border-color: #f1f5f9;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
          color: #1e293b;
        }
        .site-template-white header {
          background: rgba(255, 255, 255, 0.8) !important;
          border-bottom: 1px solid #f1f5f9 !important;
          color: #1e293b !important;
        }
        .site-template-white .text-muted-foreground {
          color: #64748b !important;
        }
        .site-template-white footer {
          background: #f8fafc !important;
          color: #1e293b !important;
          border-top: 1px solid #f1f5f9;
        }
        .site-template-white .site-hero-section {
           background: #ffffff;
        }
      `}} />
      <BlackTemplate data={data} />
    </div>
  );
}
