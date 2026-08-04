import type { PreviewProps } from "./types";
import { fontFamily, formatMoney, px, pt } from "./types";

export function PreviewMinimal({ data, config }: PreviewProps) {
  const { components: comp, styles } = config;
  const accent = config.accentColor;
  const font = fontFamily(config);
  const ink = "#334155";
  const gray = "#94A3B8";
  const titleText = (data.invoiceType === "proforma" ? "PROFORMA INVOICE" : styles.title || "INVOICE")
    .split("")
    .join(" ");
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
        color: ink,
      }}
    >
      {comp.logo && data.logo && (
        <img src={data.logo} alt="logo" style={{ maxHeight: px(11), objectFit: "contain", alignSelf: "flex-start" }} />
      )}
      {comp.logo && data.logo && data.companyAddress && (
        <div style={{ fontSize: pt(config.fontSize * 0.9), color: gray, marginTop: px(2) }}>{data.companyAddress}</div>
      )}
      {comp.companyName && data.companyName && !(comp.logo && data.logo) && (
        <div style={{ fontWeight: 700, fontSize: pt(config.fontSize * 1.7) }}>{data.companyName}</div>
      )}
      {comp.companyContact && (data.companyAddress || data.companyEmail || data.companyPhone) && (
        <div style={{ fontSize: pt(config.fontSize * 0.9), color: gray, marginTop: px(2) }}>
          {!(comp.logo && data.logo) && data.companyAddress && <div>{data.companyAddress}</div>}
          {data.companyEmail && <div>{data.companyEmail}</div>}
          {data.companyPhone && <div>{data.companyPhone}</div>}
        </div>
      )}

      {comp.metadata && (
        <>
          <div style={{ marginTop: px(16) }}>
            <div style={{ fontSize: pt(config.fontSize * 1.0), color: accent, letterSpacing: px(1) }}>{titleText}</div>
            <div style={{ borderTop: "0.4px solid #E2E8F0", marginTop: px(5) }} />
          </div>
          <div style={{ fontSize: pt(config.fontSize * 0.9), marginTop: px(8) }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: gray }}>{data.invoiceNumber}</span>
              <span>{""}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: px(2) }}>
              <span style={{ color: gray }}>Issue Date</span>
              <span style={{ color: ink }}>{data.issueDate}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: px(2) }}>
              <span style={{ color: gray }}>Due Date</span>
              <span style={{ color: ink }}>{data.dueDate}</span>
            </div>
          </div>
          <div style={{ marginTop: px(10), fontSize: pt(config.fontSize * 0.8), color: gray }}>BILL TO</div>
        </>
      )}

      {comp.clientBlock && data.clientName && (
        <>
          <div style={{ fontWeight: 700, fontSize: pt(config.fontSize * 1.1), marginTop: px(2) }}>{data.clientName}</div>
          {(data.clientAddress || data.clientEmail || data.clientPhone) && (
            <div style={{ fontSize: pt(config.fontSize * 0.9), color: gray, marginTop: px(2) }}>
              {data.clientAddress && <div>{data.clientAddress}</div>}
              {data.clientEmail && <div>Email: {data.clientEmail}</div>}
              {data.clientPhone && <div>Tel: {data.clientPhone}</div>}
            </div>
          )}
        </>
      )}

      {/* TABLE */}
      <div style={{ marginTop: px(14), flex: 1 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th colSpan={4} style={{ padding: 0 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: pt(config.fontSize * 0.8),
                    color: gray,
                    letterSpacing: px(0.8),
                    borderBottom: "0.4px solid #CBD5E1",
                    paddingBottom: px(3),
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
                <td colSpan={4} style={{ padding: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: `${px(2.5)} ${px(2)}`,
                      color: ink,
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
              <span style={{ color: "#B91C1C" }}>-{formatMoney(data.discount, data.currency)}</span>
            </div>
          )}
          {comp.total && (
            <>
              <div style={{ borderTop: "0.4px solid #94A3B8", marginTop: px(4) }} />
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: px(4), fontSize: pt(config.fontSize * 1.1), fontWeight: 700, color: ink }}>
                <span>Total</span>
                <span>{formatMoney(data.total, data.currency)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* SIGNATURE */}
      {comp.signature && data.clientName && (
        <div style={{ marginTop: px(16), display: "flex", justifyContent: "flex-end" }}>
          <div style={{ width: px(55), textAlign: "center", borderTop: "0.8px solid #94A3B8", paddingTop: px(3), fontSize: pt(config.fontSize * 0.9), color: gray }}>
            Signature
          </div>
        </div>
      )}

      {/* NOTES */}
      {comp.notes && data.notes && (
        <div style={{ marginTop: px(12), textAlign: "center" }}>
          <div style={{ borderTop: "0.4px solid #E2E8F0", marginBottom: px(6) }} />
          <div style={{ fontSize: pt(config.fontSize), color: ink, marginTop: px(2) }}>{data.notes}</div>
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
            borderTop: "0.4px solid #CBD5E1",
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