import type { PreviewProps } from "./types";
import { fontFamily, formatMoney, mixWhite, px, pt } from "./types";

export function PreviewBusiness({ data, config }: PreviewProps) {
  const { components: comp, styles } = config;
  const accent = config.accentColor;
  const secondary = config.secondaryColor;
  const font = fontFamily(config);
  const titleText =
    data.invoiceType === "proforma" ? "PROFORMA INVOICE" : styles.title || "INVOICE";
  const ink = "#111827";
  const gray = "#4B5563";
  const showPrice = comp.priceColumn;
  const showQty = comp.qtyColumn;

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
      {/* LETTERHEAD */}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div style={{ flex: 1, paddingRight: px(8) }}>
          {comp.logo && data.logo && (
            <img src={data.logo} alt="logo" style={{ maxHeight: px(12), objectFit: "contain", display: "block", marginBottom: px(4) }} />
          )}
          {comp.logo && data.logo && data.companyAddress && (
            <div style={{ fontSize: pt(config.fontSize * 0.85), color: gray, marginTop: px(1) }}>{data.companyAddress}</div>
          )}
          {comp.companyName && data.companyName && !(comp.logo && data.logo) && (
            <div style={{ fontWeight: 700, fontSize: pt(config.fontSize * 1.8), color: ink }}>{data.companyName}</div>
          )}
          {comp.companyContact && (data.companyAddress || data.companyEmail || data.companyPhone) && (
            <div style={{ fontSize: pt(config.fontSize * 0.85), color: gray, marginTop: px(2) }}>
              {!(comp.logo && data.logo) && data.companyAddress && <div>{data.companyAddress}</div>}
              <div>
                {[data.companyEmail, data.companyPhone].filter(Boolean).join("  |  ")}
              </div>
            </div>
          )}
        </div>
        {comp.metadata && (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 700, fontSize: pt(config.fontSize * 2.1), color: accent }}>{titleText}</div>
            <div style={{ fontSize: pt(config.fontSize * 1.05), color: gray }}>{data.invoiceNumber}</div>
            <div style={{ fontSize: pt(config.fontSize * 0.9), color: gray }}>Issued: {data.issueDate}</div>
            <div style={{ fontSize: pt(config.fontSize * 0.9), color: gray }}>Due: {data.dueDate}</div>
          </div>
        )}
      </div>

      <div
        style={{
          marginTop: px(8),
          borderTop: `1.2px solid ${accent}`,
          borderBottom: `0.8px solid ${mixWhite(accent, 0.6)}`,
          height: px(1.5),
        }}
      />

      {/* BODY: BILL TO + DETAILS */}
      <div style={{ display: "flex", marginTop: px(16), gap: px(30) }}>
        {comp.clientBlock && data.clientName && (
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: pt(config.fontSize * 0.8), color: gray, letterSpacing: px(0.8) }}>BILL TO</div>
            <div style={{ fontWeight: 700, fontSize: pt(config.fontSize * 1.15), color: ink, marginTop: px(3) }}>{data.clientName}</div>
            {(data.clientAddress || data.clientEmail || data.clientPhone) && (
              <div style={{ fontSize: pt(config.fontSize * 0.9), color: gray, marginTop: px(3) }}>
                {data.clientAddress && <div>{data.clientAddress}</div>}
                {data.clientEmail && <div>Email: {data.clientEmail}</div>}
                {data.clientPhone && <div>Tel: {data.clientPhone}</div>}
              </div>
            )}
          </div>
        )}
        {comp.metadata && (
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: pt(config.fontSize * 0.8), color: gray, letterSpacing: px(0.8) }}>INVOICE DETAILS</div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: pt(config.fontSize * 0.9), marginTop: px(5) }}>
              <span style={{ color: gray }}>Invoice #</span>
              <span style={{ color: ink }}>{data.invoiceNumber}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: pt(config.fontSize * 0.9), marginTop: px(2) }}>
              <span style={{ color: gray }}>Issue Date</span>
              <span style={{ color: ink }}>{data.issueDate}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: pt(config.fontSize * 0.9), marginTop: px(2) }}>
              <span style={{ color: gray }}>Due Date</span>
              <span style={{ color: ink }}>{data.dueDate}</span>
            </div>
          </div>
        )}
      </div>

      {/* TABLE */}
      <div style={{ marginTop: px(16), flex: 1 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th colSpan={4} style={{ padding: 0 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: pt(config.fontSize * 0.8),
                    color: accent,
                    fontWeight: 700,
                    borderBottom: `0.9px solid ${accent}`,
                    paddingBottom: px(2),
                    letterSpacing: px(0.5),
                  }}
                >
                  <span style={{ flex: 1 }}>DESCRIPTION</span>
                  {showPrice && <span style={{ width: "20%", textAlign: "right" }}>PRICE</span>}
                  {showQty && <span style={{ width: "8%", textAlign: "center" }}>QTY</span>}
                  <span style={{ width: "18%", textAlign: "right" }}>TOTAL</span>
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
                    padding: 0,
                    borderBottom: idx < data.lineItems.length - 1 ? "0.4px solid #E5E7EB" : "none",
                    background: styles.zebraRows && idx % 2 === 0 ? "#F9FAFB" : "transparent",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: `${px(2)} ${px(2)}`,
                      color: "#000",
                    }}
                  >
                    <span style={{ flex: 1 }}>{item.description}</span>
                    {showPrice && <span style={{ width: "20%", textAlign: "right" }}>{formatMoney(item.price, data.currency)}</span>}
                    {showQty && <span style={{ width: "8%", textAlign: "center" }}>{item.quantity}</span>}
                    <span style={{ width: "18%", textAlign: "right" }}>{formatMoney(item.total, data.currency)}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* TOTALS */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: px(8) }}>
        <div style={{ width: px(62) }}>
          {comp.subtotal && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: pt(config.fontSize), color: gray }}>
              <span>Subtotal</span>
              <span style={{ color: ink }}>{formatMoney(data.subtotal, data.currency)}</span>
            </div>
          )}
          {comp.discount && data.discount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: pt(config.fontSize), color: gray, marginTop: px(2) }}>
              <span>Discount</span>
              <span style={{ color: "#DC2626" }}>-{formatMoney(data.discount, data.currency)}</span>
            </div>
          )}
          {comp.total && (
            <div style={{ marginTop: px(4), borderTop: `0.7px solid ${secondary}`, paddingTop: px(4), display: "flex", justifyContent: "space-between", fontSize: pt(config.fontSize * 1.2), fontWeight: 700, color: secondary }}>
              <span>TOTAL</span>
              <span>{formatMoney(data.total, data.currency)}</span>
            </div>
          )}
        </div>
      </div>

      {/* SIGNATURE */}
      {comp.signature && data.clientName && (
        <div style={{ marginTop: px(16), display: "flex", justifyContent: "flex-end" }}>
          <div style={{ width: px(55), textAlign: "center", borderTop: "0.8px solid #6B7280", paddingTop: px(3), fontSize: pt(config.fontSize * 0.9), color: gray }}>
            Signature
          </div>
        </div>
      )}

      {/* NOTES */}
      {comp.notes && data.notes && (
        <div style={{ marginTop: px(12), textAlign: "center" }}>
          <div style={{ fontSize: pt(config.fontSize), color: "#1F2937" }}>{data.notes}</div>
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
            display: "flex",
            justifyContent: "space-between",
            fontSize: pt(config.fontSize * 0.8),
            color: gray,
          }}
        >
          <span>{data.companyName}</span>
          <span>Page 1 of 1</span>
        </div>
      )}
    </div>
  );
}