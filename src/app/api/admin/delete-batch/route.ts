import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import { resolve } from "path";
import { existsSync } from "fs";

export async function DELETE(req: NextRequest) {
  const { filename } = await req.json();

  if (
    typeof filename !== "string" ||
    !filename.match(/^import-queue(-[a-zA-Z0-9_-]+)?(\.manifest)?\.json$/)
  ) {
    return NextResponse.json({ error: "Nome de arquivo inválido" }, { status: 400 });
  }

  const filePath = resolve(process.cwd(), "public", "data", filename);

  if (!existsSync(filePath)) {
    return NextResponse.json({ deleted: false, reason: "not_found" });
  }

  await unlink(filePath);
  return NextResponse.json({ deleted: true });
}
