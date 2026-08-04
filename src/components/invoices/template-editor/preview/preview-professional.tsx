import type { PreviewProps } from "./types";
import { fontFamily, formatMoney, mixWhite, px, pt } from "./types";

export function PreviewProfessional({ data, config }: PreviewProps) {
  const { components: comp, styles } = config;
  const accent = config.accentColor;
  const secondary = config.secondaryColor;
  const accentLight = mixWhite(accent, 0.93);
  const font = fontFamily(config);
  const titleText =
    data.invoiceType === "proforma" ? "PROFORMA INVOICE" : styles.title || "INVOICE";
  const ink = "#111827";
  const gray = "#4B5563";
  const showPrice = comp.priceColumn;
  const showQty = comp.qtyColumn;
  const mainLeft = 20 + 38 + 10;

  return (
    <div
      style={{
        fontFamily: font,
        width: "100%",
        height: "100%",
        position: "relative",
        background: "#ffffff",
        fontSize: pt(config.fontSize),
      }}
    >
      {/* SIDEBAR */}
      <div
        style={{
          position: "absolute",
          top: px(14),
          bottom: px(14),
          left: px(20),
          width: px(38),
          background: accent,
          color: "#fff",
          padding: px(4),
          boxSizing: "border-box",
        }}
      >
        {comp.logo && data.logo && (
          <img
            src={data.logo}
            alt="logo"
            style={{ maxWidth: "100%", maxHeight: px(14), objectFit: "contain" }}
          />
        )}
        {comp.logo && data.logo && data.companyAddress && (
          <div style={{ fontSize: pt(config.fontSize * 0.78), color: "#E6EEFF", marginTop: px(4) }}>
            {data.companyAddress}
          </div>
        )}
        {comp.companyName && data.companyName && !(comp.logo && data.logo) && (
          <div
            style={{
              fontWeight: 700,
              fontSize: pt(config.fontSize * 1.25),
              lineHeight: 1.15,
            }}
          >
            {data.companyName}
          </div>
        )}
        {comp.companyContact &&
          (data.companyAddress || data.companyEmail || data.companyPhone) && (
            <div style={{ fontSize: pt(config.fontSize * 0.78), color: "#E6EEFF", marginTop: px(4) }}>
              {!(comp.logo && data.logo) && data.companyAddress && <div>{data.companyAddress}</div>}
              {data.companyEmail && <div>{data.companyEmail}</div>}
              {data.companyPhone && <div>{data.companyPhone}</div>}
            </div>
          )}
      </div>

      {/* MAIN */}
      <div style={{ marginLeft: px(mainLeft), paddingRight: px(20), height: "100%", position: "relative" }}>
        <div
          style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            paddingBottom: comp.footer ? px(24) : 0,
          }}
        >
          {comp.metadata && (
            <div style={{ textAlign: "right", marginTop: px(6) }}>
              <div style={{ fontWeight: 700, fontSize: pt(config.fontSize * 2.3), color: accent }}>
                {titleText}
              </div>
              <div style={{ fontSize: pt(config.fontSize * 1.05), color: ink }}>{data.invoiceNumber}</div>
              <div style={{ fontSize: pt(config.fontSize * 0.9), color: gray, marginTop: px(2) }}>
                Issue Date: {data.issueDate}
              </div>
              <div style={{ fontSize: pt(config.fontSize * 0.9), color: gray }}>
                Due Date: {data.dueDate}
              </div>
            </div>
          )}

          {comp.clientBlock && data.clientName && (
            <div style={{ marginTop: px(14) }}>
              <div style={{ fontSize: pt(config.fontSize * 0.8), color: gray, letterSpacing: px(0.8) }}>
                BILL TO
              </div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: pt(config.fontSize * 1.2),
                  color: ink,
                  marginTop: px(2),
                }}
              >
                {data.clientName}
              </div>
              {(data.clientAddress || data.clientEmail || data.clientPhone) && (
                <div style={{ fontSize: pt(config.fontSize * 0.9), color: gray, marginTop: px(3) }}>
                  {data.clientAddress && <div>{data.clientAddress}</div>}
                  {data.clientEmail && <div>Email: {data.clientEmail}</div>}
                  {data.clientPhone && <div>Tel: {data.clientPhone}</div>}
                </div>
              )}
            </div>
          )}

          {/* TABLE */}
          <div style={{ marginTop: px(14), flex: 1 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th colSpan={4} style={{ padding: 0 }}>
                    <div
                      style={{
                        background: styles.tableHeaderFill ? accentLight : "transparent",
                        borderBottom: `1.6px solid ${accent}`,
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: pt(config.fontSize * 0.85),
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
                        padding: 0,
                        background:
                          styles.zebraRows && idx % 2 === 0 ? "#F5F6FC" : "transparent",
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

          {/* TOTALS boxed */}
          {(comp.subtotal || comp.discount || comp.total) && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: px(10) }}>
              <div
                style={{
                  width: px(66),
                  background: "#F8F9FE",
                  borderLeft: `2.2px solid ${accent}`,
                  padding: `${px(6)} ${px(6)}`,
                }}
              >
                {comp.subtotal && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: pt(config.fontSize),
                      color: gray,
                    }}
                  >
                    <span>Subtotal</span>
                    <span style={{ color: ink }}>{formatMoney(data.subtotal, data.currency)}</span>
                  </div>
                )}
                {comp.discount && data.discount > 0 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: pt(config.fontSize),
                      marginTop: px(2),
                    }}
                  >
                    <span style={{ color: gray }}>Discount</span>
                    <span style={{ color: "#DC2626" }}>
                      -{formatMoney(data.discount, data.currency)}
                    </span>
                  </div>
                )}
                {comp.total && (
                  <>
                    <div style={{ borderTop: `0.8px solid ${secondary}`, marginTop: px(4) }} />
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        paddingTop: px(4),
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
          )}

          {/* SIGNATURE */}
          {comp.signature && data.clientName && (
            <div style={{ marginTop: px(14), display: "flex", justifyContent: "flex-end" }}>
              <div
                style={{
                  width: px(55),
                  textAlign: "center",
                  borderTop: "0.8px solid #6B7280",
                  paddingTop: px(3),
                  fontSize: pt(config.fontSize * 0.9),
                  color: gray,
                }}
              >
                Signature
              </div>
            </div>
          )}

          {/* NOTES */}
          {comp.notes && data.notes && (
            <div style={{ marginTop: px(12), textAlign: "center" }}>
              <div style={{ fontSize: pt(config.fontSize), color: "#1F2937" }}>
                {data.notes}
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        {comp.footer && (
          <div
            style={{
              position: "absolute",
              bottom: px(12),
              left: 0,
              right: 0,
              borderTop: `0.8px solid ${accent}`,
              paddingTop: px(3),
              display: "flex",
              justifyContent: "space-between",
              fontSize: pt(config.fontSize * 0.8),
              color: accent,
            }}
          >
            <span>{data.companyName}</span>
            <span>Page 1 of 1</span>
          </div>
        )}
      </div>
    </div>
  );
}