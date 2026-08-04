import type { PreviewProps } from "./types";
import { fontFamily, formatMoney, mixWhite, px, pt } from "./types";

export function PreviewModern({ data, config }: PreviewProps) {
  const { components: comp, styles } = config;
  const accent = config.accentColor;
  const secondary = config.secondaryColor;
  const accentLight = mixWhite(accent, 0.9);
  const secondaryLight = mixWhite(secondary, 0.9);
  const font = fontFamily(config);
  const titleText =
    data.invoiceType === "proforma"
      ? "PROFORMA INVOICE"
      : styles.title || "INVOICE";

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
      {/* HEADER */}
      <div style={{ display: "flex", gap: px(6.8), minHeight: px(34) }}>
        <div style={{ flex: "0 0 55%" }}>
          {comp.logo && data.logo && (
            <img
              src={data.logo}
              alt="logo"
              style={{ maxWidth: "100%", maxHeight: px(32), objectFit: "contain" }}
            />
          )}
          {comp.logo && data.logo && data.companyAddress && (
            <div style={{ fontSize: pt(config.fontSize * 0.9), color: "#6B7280", marginTop: px(2) }}>
              {data.companyAddress}
            </div>
          )}
          {comp.companyName && data.companyName && !(comp.logo && data.logo) && (
            <div style={{ fontWeight: 700, fontSize: pt(config.fontSize * 1.4), color: "#1E293B" }}>
              {data.companyName}
            </div>
          )}
          {comp.companyContact &&
            (data.companyAddress || data.companyEmail || data.companyPhone) && (
              <div style={{ fontSize: pt(config.fontSize * 0.9), color: "#6B7280", marginTop: px(2) }}>
                {!(comp.logo && data.logo) && data.companyAddress && <div>{data.companyAddress}</div>}
                {data.companyEmail && <div>{data.companyEmail}</div>}
                {data.companyPhone && <div>{data.companyPhone}</div>}
              </div>
            )}
        </div>
        {comp.metadata && (
          <div style={{ flex: "1", textAlign: "right" }}>
            <div style={{ fontSize: pt(28), fontWeight: 700, color: accent }}>
              {titleText}
            </div>
            <div style={{ fontSize: pt(config.fontSize * 1.1), color: "#000", marginTop: px(4) }}>
              {data.invoiceNumber}
            </div>
            <div style={{ fontSize: pt(config.fontSize), color: "#6B7280", marginTop: px(3) }}>
              Issue Date: {data.issueDate}
            </div>
            <div style={{ fontSize: pt(config.fontSize), color: "#6B7280" }}>
              Due Date: {data.dueDate}
            </div>
          </div>
        )}
      </div>

      {/* CLIENT CARD */}
      {comp.clientBlock && data.clientName && (
        <div
          style={{
            marginTop: px(14),
            background: "#F8F8F8",
            border: "1px solid #E5E7EB",
            borderRadius: px(2),
            padding: px(4),
            width: "55%",
          }}
        >
          <div style={{ fontSize: pt(config.fontSize), color: "#6B7280" }}>Bill To:</div>
          <div style={{ fontSize: pt(config.fontSize * 1.15), fontWeight: 700, marginTop: px(2) }}>
            {data.clientName}
          </div>
          {(data.clientEmail || data.clientPhone || data.clientAddress) && (
            <div style={{ fontSize: pt(config.fontSize * 0.9), color: "#6B7280", marginTop: px(2) }}>
              {data.clientEmail && <div>Email: {data.clientEmail}</div>}
              {data.clientPhone && <div>Tel: {data.clientPhone}</div>}
              {data.clientAddress && <div>Address: {data.clientAddress}</div>}
            </div>
          )}
        </div>
      )}

      {/* TABLE */}
      <div style={{ marginTop: px(16), flex: 1 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th
                colSpan={4}
                style={{
                  padding: 0,
                }}
              >
                <div
                  style={{
                    background: styles.tableHeaderFill ? accentLight : "transparent",
                    borderBottom: `1.6px solid ${accent}`,
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: pt(8),
                    color: accent,
                    fontWeight: 700,
                    padding: `${px(1.5)} ${px(2)}`,
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
                    background: styles.zebraRows && idx % 2 === 0 ? "#F9FAFB" : "transparent",
                    padding: 0,
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

      {/* TOTALS */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: px(6) }}>
        <div style={{ width: px(60) }}>
          {comp.subtotal && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: pt(config.fontSize), color: "#6B7280" }}>
              <span>Subtotal:</span>
              <span style={{ color: "#000" }}>{formatMoney(data.subtotal, data.currency)}</span>
            </div>
          )}
          {comp.discount && data.discount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: pt(config.fontSize), color: "#6B7280", marginTop: px(2) }}>
              <span>Discount:</span>
              <span style={{ color: "#DC2626" }}>-{formatMoney(data.discount, data.currency)}</span>
            </div>
          )}
          {comp.total && (
            <>
              <div style={{ borderTop: `1px solid ${secondary}`, marginTop: px(5) }} />
              <div
                style={{
                  background: styles.totalsFill ? secondaryLight : "transparent",
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: pt(config.fontSize * 1.25),
                  fontWeight: 700,
                  color: secondary,
                  padding: `${px(2)} ${px(2)}`,
                }}
              >
                <span>Total:</span>
                <span>{formatMoney(data.total, data.currency)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* SIGNATURE */}
      {comp.signature && data.clientName && (
        <div style={{ marginTop: px(16), display: "flex", justifyContent: "flex-end" }}>
          <div style={{ width: px(55), textAlign: "center", borderTop: "0.8px solid #6B7280", paddingTop: px(3), fontSize: pt(config.fontSize * 0.9), color: "#6B7280" }}>
            Signature
          </div>
        </div>
      )}

      {/* NOTES */}
      {comp.notes && data.notes && (
        <div style={{ marginTop: px(14), textAlign: "center" }}>
          <div style={{ borderTop: `1px solid ${accent}`, marginBottom: px(5) }} />
          <div style={{ fontSize: pt(config.fontSize) }}>{data.notes}</div>
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
            color: "#6B7280",
          }}
        >
          <span>{data.companyName}</span>
          <span>Page 1 of 1</span>
        </div>
      )}
    </div>
  );
}
