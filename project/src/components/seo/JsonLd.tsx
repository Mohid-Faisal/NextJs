import React from "react";

type JsonLdProps = {
  data: Record<string, unknown> | Array<Record<string, unknown>>;
};

/**
 * Renders Schema.org structured data safely inside a script tag.
 */
export function JsonLd({ data }: JsonLdProps) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
