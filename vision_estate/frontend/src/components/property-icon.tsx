export function PropertyIcon({ type }: { type: string }) {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {type === "APARTMENT" ? (
        <>
          <path d="M7 28V5h18v23M4 28h24M13 28v-6h6v6M11 10h2m6 0h2m-10 5h2m6 0h2" />
        </>
      ) : type === "HOUSE" ? (
        <>
          <path d="m3 15 13-11 13 11M7 12v16h18V12M13 28v-9h6v9M22 8V4h3v7" />
        </>
      ) : (
        <>
          <path d="m3 23 13-7 13 7-13 7-13-7ZM16 16V3m0 1 9 3-9 4M8 16l-4-2 9-5" />
        </>
      )}
    </svg>
  );
}
