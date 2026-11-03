import Link from "next/link";
import {
  ClipboardList,
  Database,
  LayoutDashboard,
  LogOut,
} from "lucide-react";
import { logout } from "@/app/auth-actions";

type BlackFridaySidebarProps = {
  canManage: boolean;
  userName: string;
};

export default function BlackFridaySidebar({
  userName,
}: BlackFridaySidebarProps) {
  return (
    <aside className="bf-sidebar" aria-label="Navegação interna">
      <Link href="/" className="bf-sidebar-brand">
        <span className="bf-sidebar-brand-mark">FT</span>
        <span>
          <strong>Forms Transp</strong>
          <small>BLACK FRIDAY 2026</small>
        </span>
      </Link>

      <div className="bf-sidebar-section-label">OPERAÇÃO</div>

      <nav className="bf-sidebar-nav" aria-label="Menu principal">

        <Link href="/" className="bf-sidebar-link">
          <LayoutDashboard size={17} />
          <span>Admin</span>
        </Link>

        <Link href="/base-completa" className="bf-sidebar-link">
          <Database size={17} />
          <span>Base Completa</span>
        </Link>
      </nav>

      <div className="bf-sidebar-footer">
        <div className="bf-sidebar-user">
          <ClipboardList size={16} />
          <span title={userName}>{userName}</span>
        </div>

        <form action={logout}>
          <button type="submit" className="bf-sidebar-logout">
            <LogOut size={17} />
            <span>Sair</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
