import { BlackTemplate } from "./BlackTemplate";
import type { SiteData } from "@/lib/site/types";

export function BurgerTemplate({ data }: { data: SiteData }) {
  return (
    <div className="site-template-burger min-h-screen bg-[#F3F4F6] text-slate-900">
      <style dangerouslySetInnerHTML={{ __html: `
        .site-template-burger {
          --primary: 35 100% 43%; /* Yellow/Orange */
          --primary-foreground: 0 0% 0%;
        }
        .site-template-burger .card-premium {
          background: white;
          border-radius: 0.75rem;
          box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
        }
        .site-template-burger .btn-premium {
          background: #D99000;
          color: white;
        }
      `}} />
      <BlackTemplate data={data} />
    </div>
  );
}
