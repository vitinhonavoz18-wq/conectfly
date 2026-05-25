import { BlackTemplate } from "./BlackTemplate";
import type { SiteData } from "@/lib/site/types";

export function PizzaRedTemplate({ data }: { data: SiteData }) {
  return (
    <div className="site-template-red min-h-screen bg-white text-slate-900">
      <style dangerouslySetInnerHTML={{ __html: `
        .site-template-red {
          --primary: 0 84% 45%; /* Red */
          --primary-foreground: 0 0% 100%;
        }
        .site-template-red header {
          background: #E50914 !important;
          color: white !important;
        }
        .site-template-red header h1, 
        .site-template-red header span,
        .site-template-red header button {
          color: white !important;
        }
        .site-template-red .card-premium {
          background: white;
          border-color: #fee2e2;
          border-radius: 1rem;
        }
        .site-template-red .btn-premium {
          background: #E50914;
          color: white;
        }
        .site-template-red .text-primary {
          color: #E50914 !important;
        }
        .site-template-red .bg-primary {
          background-color: #E50914 !important;
        }
      `}} />
      <BlackTemplate data={data} />
    </div>
  );
}
