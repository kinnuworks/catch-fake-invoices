const ADDRESS = /(0x[a-fA-F0-9]{40})/g;

/** Long wallets are slow to compare, so the start and end stand out. */
export function WithAddresses({ text }: { text: string }) {
  return (
    <>
      {text.split(ADDRESS).map((part, i) =>
        i % 2 === 1 ? (
          <span className="addr" key={i}>
            <b>{part.slice(0, 6)}</b>
            <span>{part.slice(6, -4)}</span>
            <b>{part.slice(-4)}</b>
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}
