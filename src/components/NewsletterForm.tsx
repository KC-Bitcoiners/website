import React from "react";

const FORMSTR_URL =
  "https://formstr.app/f/naddr1qvzqqqr4mqpzp6x7p0f85ac535y2keamf6u5q0pzekh6r3r06tvkseg0zq5rkdmzqythwumn8ghj7un9d3shjtnswf5k6ctv9ehx2ap0qy88wumn8ghj7mn0wvhxcmmv9uq36amnwvaz7tmwdaehgu3dxqcju7tpdd5ksmmwdejjucm0d5hsz8nhwden5te0wfjkccte9ehx7um5wgh8w6tjv4jxuet59e48qtcqqee9q7teg9qs9qlcve?viewKey=b8c15cccd9ec24e429bd0360a47c115888278f596ac965acad970bcc23ccee44&hideTitleImage=true&hideDescription=true";

export default function NewsletterForm() {
  return (
    <iframe
      sandbox="allow-scripts allow-same-origin allow-forms"
      loading="lazy"
      src={FORMSTR_URL}
      height="700px"
      width="100%"
      frameBorder="0"
      style={{
        borderStyle: "none",
        boxShadow: "0px 0px 2px 2px rgba(0,0,0,0.2)",
        maxWidth: "480px",
        margin: "0 auto",
        display: "block",
      }}
      title="Newsletter Signup"
    />
  );
}
