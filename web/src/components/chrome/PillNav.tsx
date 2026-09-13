import { NavLink } from "./NavLink";
import { NAV_ITEMS } from "./nav-items";

/** Floating pill nav below `lg`; the main column reserves `--pill-nav-clearance` beneath it. */
export function PillNav() {
  return (
    <nav aria-label="Primary" className="pointer-events-none fixed inset-x-0 bottom-(--pill-nav-offset) z-40 flex justify-center lg:hidden">
      <ul className="pointer-events-auto flex items-center gap-1 rounded-full border border-border-strong bg-surface-3 p-1">
        {NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <NavLink {...item} layout="pill" />
          </li>
        ))}
      </ul>
    </nav>
  );
}
