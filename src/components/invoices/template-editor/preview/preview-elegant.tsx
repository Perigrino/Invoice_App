import type { PreviewProps } from "./types";
import { fontFamily, formatMoney, mixWhite, px, pt } from "./types";

export function PreviewElegant({ data, config }: PreviewProps) {
  const { components: comp, styles } = config;
  const accent = config.accentColor;
  const secondary = config.secondaryColor;
  const font = fontFamily(config);
  const ink = "#1E1B14";
  const gray = "#6B7280";
  const titleText =
    data.invoiceType === "proforma"
      ? "PROFORMA INVOICE"
      : styles.title || "INVOICE";

  const showPrice = comp.priceColumn;
  const showQty = comp.qtyColumn;
  const ornament = (marginTop = 0) => (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: px(8),
        marginTop: px(marginTop),
      }}
    >
      <div style={{ width: px(26), borderTop: `0.4px solid ${accent}` }} />
      <div style={{ width: px(8), height: 1 }} />
      <div style={{ width: px(26), borderTop: `0.4px solid ${accent}` }} />
    </div>
  );

  return (
    <div
      style={{
        fontFamily: font,
        width: "100%",
        height: "100%",
        padding: px(20),
        position: "relative",
        display: "flex",
        flexDirection: "column",
        fontSize: pt(config.fontSize),
      }}
    >
      {/* HEADER (centered) */}
      <div style={{ textAlign: "center" }}>
        {comp.logo && data.logo && (
          <img
            src={data.logo}
            alt="logo"
            style={{ maxWidth: "60%", maxHeight: px(12), objectFit: "contain" }}
          />
        )}
        {comp.logo && data.logo && data.companyAddress && (
          <div style={{ fontSize: pt(config.fontSize * 0.85), color: gray, marginTop: px(2) }}>
            {data.companyAddress}
          </div>
        )}
        {comp.companyName && data.companyName && !(comp.logo && data.logo) && (
          <div
            style={{
              fontWeight: 700,
              fontSize: pt(config.fontSize * 1.6),
              color: ink,
            }}
          >
            {data.companyName}
          </div>
        )}
        {comp.companyContact &&
          (data.companyAddress || data.companyEmail || data.companyPhone) && (
            <div style={{ fontSize: pt(config.fontSize * 0.85), color: gray }}>
              {!(comp.logo && data.logo) && data.companyAddress && <div style={{ marginTop: px(2) }}>{data.companyAddress}</div>}
              {data.companyEmail && <div style={{ marginTop: px(2) }}>{data.companyEmail}</div>}
              {data.companyPhone && <div style={{ marginTop: px(2) }}>{data.companyPhone}</div>}
            </div>
          )}
      </div>

      {/* METADATA (ornament + title + dates) */}
      {comp.metadata && (
        <div style={{ textAlign: "center" }}>
          {ornament(8)}
          <div
            style={{
              fontWeight: 700,
              fontSize: pt(config.fontSize * 1.9),
              color: accent,
              marginTop: px(7),
              letterSpacing: pt(0.5),
            }}
          >
            {titleText.toUpperCase()}
          </div>
          {ornament(6)}
          <div style={{ fontSize: pt(config.fontSize * 0.9), color: gray, marginTop: px(8) }}>
            No. {data.invoiceNumber} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&bull;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Issued {data.issueDate} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&bull;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Due {data.dueDate}
          </div>
        </div>
      )}

      {/* CLIENT (centered) */}
      {comp.clientBlock && data.clientName && (
        <div style={{ textAlign: "center", marginTop: px(12) }}>
          <div style={{ fontSize: pt(config.fontSize * 0.8), color: gray, letterSpacing: pt(0.8) }}>
            BILL TO
          </div>
          <div style={{ fontWeight: 700, fontSize: pt(config.fontSize * 1.1), color: ink, marginTop: px(3) }}>
            {data.clientName}
          </div>
          {(data.clientAddress || data.clientEmail || data.clientPhone) && (
            <div style={{ fontSize: pt(config.fontSize * 0.9), color: gray }}>
              {data.clientAddress && <div style={{ marginTop: px(3) }}>{data.clientAddress}</div>}
              {data.clientEmail && <div style={{ marginTop: px(3) }}>Email: {data.clientEmail}</div>}
              {data.clientPhone && <div style={{ marginTop: px(3) }}>Tel: {data.clientPhone}</div>}
            </div>
          )}
        </div>
      )}

      {/* TABLE */}
      <div style={{ marginTop: px(16), flex: 1 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th colSpan={4} style={{ padding: 0 }}>
                <div
                  style={{
                    background: styles.tableHeaderFill ? mixWhite(accent, 0.95) : "transparent",
                    borderBottom: `1px solid ${accent}`,
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: pt(config.fontSize * 0.85),
                    color: accent,
                    fontWeight: 700,
                    padding: `${px(1.5)} ${px(1.5)}`,
                  }}
                >
                  <span style={{ flex: 1 }}>Description</span>
                  {showPrice && <span style={{ width: "20%", textAlign: "right" }}>Price</span>}
                  {showQty && <span style={{ width: "8%", textAlign: "center" }}>Qty</span>}
                  <span style={{ width: "18%", textAlign: "right" }}>Total</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.lineItems.map((item, idx) => (
              <tr key={idx}>
                <td
                  colSpan={4}
                  style={{
                    borderBottom: `0.3px solid #E1DACD`,
                    padding: 0,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: `${px(2)} ${px(1.5)}`,
                      color: ink,
                    }}
                  >
                    <span style={{ flex: 1 }}>{item.description}</span>
                    {showPrice && (
                      <span style={{ width: "20%", textAlign: "right" }}>
                        {formatMoney(item.price, data.currency)}
                      </span>
                    )}
                    {showQty && (
                      <span style={{ width: "8%", textAlign: "center" }}>{item.quantity}</span>
                    )}
                    <span style={{ width: "18%", textAlign: "right" }}>
                      {formatMoney(item.total, data.currency)}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* TOTALS (boxed, double border) */}
      {(comp.subtotal || comp.discount || comp.total) && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: px(8) }}>
          <div style={{ width: px(64), border: `0.4px solid ${accent}`, padding: px(4) }}>
            <div style={{ border: `0.15px solid ${secondary}`, padding: px(2) }}>
              {comp.subtotal && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: pt(config.fontSize), color: gray, padding: `${px(1.5)} 0` }}>
                  <span>Subtotal</span>
                  <span style={{ color: ink }}>{formatMoney(data.subtotal, data.currency)}</span>
                </div>
              )}
              {comp.discount && data.discount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: pt(config.fontSize), color: gray, padding: `${px(1.5)} 0` }}>
                  <span>Discount</span>
                  <span style={{ color: "#B22222" }}>-{formatMoney(data.discount, data.currency)}</span>
                </div>
              )}
              {comp.total && (
                <>
                  <div style={{ borderTop: `0.3px solid ${accent}`, marginTop: px(3), paddingTop: px(3) }} />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: pt(config.fontSize * 1.2),
                      fontWeight: 700,
                      color: secondary,
                    }}
                  >
                    <span>Total</span>
                    <span>{formatMoney(data.total, data.currency)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SIGNATURE */}
      {comp.signature && data.clientName && (
        <div style={{ marginTop: px(16), display: "flex", justifyContent: "center" }}>
          <div style={{ width: px(55), textAlign: "center", borderTop: "0.8px solid #6B7280", paddingTop: px(3), fontSize: pt(config.fontSize * 0.9), color: gray }}>
            Signature
          </div>
        </div>
      )}

      {/* NOTES (centered) */}
      {comp.notes && data.notes && (
        <div style={{ marginTop: px(16), textAlign: "center" }}>
          <div style={{ width: px(48), borderTop: `0.4px solid ${accent}`, margin: "0 auto", marginBottom: px(6) }} />
          <div style={{ fontSize: pt(config.fontSize), color: ink, marginTop: px(3) }}>{data.notes}</div>
        </div>
      )}

      {/* FOOTER */}
      {comp.footer && (
        <div
          style={{
            position: "absolute",
            bottom: px(12),
            left: px(20),
            right: px(20),
            borderTop: "0.8px solid #E5E7EB",
            paddingTop: px(3),
            textAlign: "center",
            fontSize: pt(config.fontSize * 0.8),
            color: accent,
          }}
        >
          {data.companyName} &nbsp;&nbsp;•&nbsp;&nbsp; Page 1 of 1
        </div>
      )}
    </div>
  );
}
