import { NextRequest, NextResponse } from "next/server";
import docRates from "../../../../public/DHL PK RATES DOC.json";
import nonDocRates from "../../../../public/DHL PK RATES NON_DOC.json"; 

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { region, weight } = body;

  if (!region || !weight) {
    return NextResponse.json({ error: "Region and weight are required." }, { status: 400 });
  }

  const weightNumber = parseFloat(weight);

  const findRate = (rates: any[], type: string) => {
    const entry = rates.find((row) => Number(row["Weight(Kg)"]) === weightNumber);
    if (entry && region in entry) {
      const rawPrice = entry[region];
      const cleanPrice = rawPrice.replace(/,/g, "");
      return { type, price: cleanPrice };
    }
    return null;
  };

  const docResult = findRate(docRates, "DOC");

  const nonDocResult = findRate(nonDocRates, "NON_DOC");

  if (!docResult && !nonDocResult) {
    return NextResponse.json({ error: "No matching rate found." }, { status: 404 });
  }

  const result: any = {};
  if (docResult) result["DOC"] = docResult.price;
  if (nonDocResult) result["NON_DOC"] = nonDocResult.price;

  return NextResponse.json(result);
}
