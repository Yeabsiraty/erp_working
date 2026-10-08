const PATHS = {
  dashboard: "M4 4h6.5v7.5H4z M13.5 4H20v4.5h-6.5z M13.5 11.5H20V20h-6.5z M4 14.5h6.5V20H4z",
  sales: "M6 3h12v18l-2.5-1.8L13 21l-2-1.8L8.5 21 6 19.2z M9 8h6 M9 12h6",
  stock: "M3.5 7.5L12 3.5l8.5 4v9l-8.5 4-8.5-4z M3.5 7.5L12 11.5l8.5-4 M12 11.5v9",
  debts: "M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20 M10 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M20 20v-1.5a3.5 3.5 0 0 0-2.6-3.4 M15.5 5.2a3.5 3.5 0 0 1 0 6.6",
  expenses: "M3.5 8h17v11.5h-17z M3.5 8l2.5-4h12l2.5 4 M15.5 13.5h2",
  proforma: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5 M8.5 13h7 M8.5 17h5",
  payment: "M3.5 6h17v12h-17z M3.5 10h17 M7 14.5h3",
  delivery: "M3 6.5h11v9H3z M14 9.5h3.5l3 3v3h-6.5z M7 18.5a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z M17 18.5a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z",
  settings: "M4 7h9 M17 7h3 M4 17h3 M11 17h9 M15 4.5v5 M9 14.5v5",
  plus: "M12 5v14 M5 12h14",
  trash: "M4 7h16 M10 11v6 M14 11v6 M6 7l1 12.5h10L18 7 M9 7V4h6v3",
  edit: "M4 20h4L19.5 8.5l-4-4L4 16z M13.5 6.5l4 4",
  printer: "M7 9V3.5h10V9 M7 17H4.5v-7h15v7H17 M7.5 14h9v6.5h-9z",
  logout: "M9.5 20.5H5V3.5h4.5 M16 16.5l4.5-4.5L16 7.5 M20.5 12H9",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2.5v2 M12 19.5v2 M4.8 4.8l1.4 1.4 M17.8 17.8l1.4 1.4 M2.5 12h2 M19.5 12h2 M4.8 19.2l1.4-1.4 M17.8 6.2l1.4-1.4",
  moon: "M20.5 13.5A8.5 8.5 0 1 1 10.5 3.5a6.5 6.5 0 0 0 10 10z",
  x: "M6 6l12 12 M18 6L6 18",
  back: "M19 12H5 M11.5 18.5L5 12l6.5-6.5",
  check: "M5 12.5l4.5 4.5L19 7.5",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M20 20l-3.5-3.5",
  open: "M14 4h6v6 M20 4l-9 9 M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
};

export default function Icon({ name, size = 20, className = "" }) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name] || ""} />
    </svg>
  );
}
