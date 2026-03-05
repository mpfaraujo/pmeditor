"use client";

/**
 * ProvaHeader — componente único para todos os layouts de cabeçalho (0–10).
 * Cada layout é uma função interna que recebe os mesmos campos e helpers.
 *
 * Para adicionar um novo layout:
 * 1. Crie uma função LayoutN abaixo
 * 2. Adicione o case no switch do ProvaHeader
 */

import React from "react";

export interface ProvaHeaderProps {
  layout?: number; // 0–10, default 0
  logoUrl: string | null;
  logoPlaceholder?: string;
  onLogoClick: () => void;
  isEditable?: boolean;
  nome?: string;
  turma?: string;
  professor?: string;
  disciplina?: string;
  data?: string;
  nota?: string;
  instituicao?: string;
  /** Chamado ao sair de um campo editável. field = chave do ProvaConfig. */
  onFieldChange?: (field: string, value: string) => void;
}

// ─── helpers ────────────────────────────────────────────────────────────────

function formatDateBR(value: string) {
  if (!value) return "";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y.slice(2)}`;
}

/** Retorna atributos contentEditable quando o header está em modo edição. */
function ed(
  field: string,
  isEditable: boolean,
  onFieldChange?: (field: string, value: string) => void
): React.HTMLAttributes<HTMLElement> {
  if (!isEditable) return {};
  return {
    contentEditable: true,
    suppressContentEditableWarning: true,
    onBlur: (e: React.FocusEvent<HTMLElement>) =>
      onFieldChange?.(field, e.currentTarget.textContent ?? ""),
  };
}

// ─── layouts ────────────────────────────────────────────────────────────────

function Layout0({
  logoUrl, logoPlaceholder, onLogoClick, isEditable,
  nome, turma, professor, disciplina, data, nota, instituicao,
  onFieldChange,
}: ProvaHeaderProps) {
  const E = (f: string) => ed(f, !!isEditable, onFieldChange);
  return (
    <div className="mb-[0.8cm]">
      <div className="grid grid-cols-[2.3cm_1fr_4cm] gap-[0.15cm] items-stretch">
        <div
          className={`logo-area [grid-row:auto] flex items-center justify-center text-xs font-bold ${isEditable ? "cursor-pointer" : "cursor-default"} ${logoUrl ? "" : "border-2 border-gray-800"}`}
          onClick={isEditable ? onLogoClick : undefined}
        >
          {logoUrl ? (
            <img src={logoUrl} alt="Logo da instituição" className="max-w-full max-h-full object-contain" />
          ) : (
            <span className="text-xs font-bold">{logoPlaceholder?.trim() ?? ""}</span>
          )}
        </div>

        <div className="relative pt-2">
          <div className="absolute top-0 left-[6px] text-[7pt] font-normal bg-white px-[3px] z-[1]">Nome</div>
          <div className="border border-black rounded-[5px] py-[0.3em] px-[6px] min-h-[22px] outline-none w-full box-border focus:bg-[#f9f9f9] flex items-end" {...E("nome")}>
            <span className="leading-[1.1]">{nome ?? ""}</span>
          </div>
        </div>

        <div className="relative pt-2">
          <div className="absolute top-0 left-[6px] text-[7pt] font-normal bg-white px-[3px] z-[1]">Turma</div>
          <div className="border border-black rounded-[5px] py-[0.3em] px-[6px] min-h-[22px] outline-none w-full box-border focus:bg-[#f9f9f9] flex items-end" {...E("turma")}>
            <span className="leading-[1.1]">{turma ?? ""}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_1fr_3cm_3cm] gap-[0.15cm] mb-[0.05cm] items-stretch">
        <div className="relative pt-2">
          <div className="absolute top-0 left-[6px] text-[7pt] font-normal bg-white px-[3px] z-[1]">Professor</div>
          <div className="border border-black rounded-[5px] py-[0.3em] px-[6px] min-h-[22px] outline-none w-full box-border focus:bg-[#f9f9f9] flex items-end" {...E("professor")}>
            <span className="leading-[1.1]">{professor ?? ""}</span>
          </div>
        </div>

        <div className="relative pt-2">
          <div className="absolute top-0 left-[6px] text-[7pt] font-normal bg-white px-[3px] z-[1]">Disciplina</div>
          <div className="border border-black rounded-[5px] py-[0.3em] px-[6px] min-h-[22px] outline-none w-full box-border focus:bg-[#f9f9f9] flex items-end" {...E("disciplina")}>
            <span className="leading-[1.1]">{disciplina ?? ""}</span>
          </div>
        </div>

        <div className="relative pt-2">
          <div className="absolute top-0 left-[6px] text-[7pt] font-normal bg-white px-[3px] z-[1]">Data</div>
          <div className="border border-black rounded-[5px] py-[0.3em] px-[6px] min-h-[22px] outline-none w-full box-border focus:bg-[#f9f9f9] flex items-end" {...E("data")}>
            <span className="leading-[1.1]">{formatDateBR(data ?? "")}</span>
          </div>
        </div>

        <div className="relative pt-2">
          <div className="absolute top-0 left-[6px] text-[7pt] font-normal bg-white px-[3px] z-[1]">Nota</div>
          <div className="border border-black rounded-[5px] py-[0.3em] px-[6px] min-h-[22px] outline-none w-full box-border focus:bg-[#f9f9f9] flex items-end" {...E("nota")}>
            <span className="leading-[1.1]">{nota ?? ""}</span>
          </div>
        </div>
      </div>

      <div
        className="bg-[#666] text-white text-center p-[3px] font-bold outline-none mt-[0.1cm] rounded-[5px] [print-color-adjust:exact] [-webkit-print-color-adjust:exact]"
        {...E("instituicao")}
      >
        {instituicao ?? ""}
      </div>
    </div>
  );
}

function Layout1({
  logoUrl, logoPlaceholder, onLogoClick, isEditable,
  nome, turma, professor, disciplina, data, nota, instituicao,
  onFieldChange,
}: ProvaHeaderProps) {
  const E = (f: string) => ed(f, !!isEditable, onFieldChange);
  return (
    <div className="border-2 border-gray-800 w-[18cm] mb-4">
      <div className="grid grid-cols-12">
        <div
          className={`logo-area col-span-2 flex items-center justify-center text-xs font-bold border-r-2 border-gray-800 p-1 ${isEditable ? "cursor-pointer" : "cursor-default"}`}
          onClick={isEditable ? onLogoClick : undefined}
        >
          {logoUrl ? (
            <img src={logoUrl} alt="Logo da instituição" className="object-contain" style={{ maxWidth: "min(100%, 2cm)", maxHeight: "min(100%, 2cm)" }} />
          ) : (
            <span className="text-xs font-bold">{logoPlaceholder?.trim() ?? ""}</span>
          )}
        </div>

        <div className="col-span-10">
          <div className="p-2 border-b-2 border-gray-800">
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-8">
                <label className="block text-xs font-medium text-gray-600 mb-0.5">Nome</label>
                <div className="border-b-2 border-gray-800 h-6 flex items-end pb-0.5" {...E("nome")}>
                  <span className="text-sm">{nome ?? ""}</span>
                </div>
              </div>
              <div className="col-span-4 grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Turma</label>
                  <div className="border-b-2 border-gray-800 h-6 flex items-end pb-0.5" {...E("turma")}>
                    <span className="text-sm">{turma ?? ""}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Data</label>
                  <div className="border-b-2 border-gray-800 h-6 flex items-end pb-0.5" {...E("data")}>
                    <span className="text-sm">{formatDateBR(data ?? "")}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-0.5">Nota</label>
                  <div className="border-b-2 border-gray-800 h-6 flex items-end pb-0.5" {...E("nota")}>
                    <span className="text-sm">{nota ?? ""}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-2 border-b-2 border-gray-800">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-0.5">Professor</label>
                <div className="border-b-2 border-gray-800 h-6 flex items-end pb-0.5" {...E("professor")}>
                  <span className="text-sm">{professor ?? ""}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-0.5">Disciplina</label>
                <div className="border-b-2 border-gray-800 h-6 flex items-end pb-0.5" {...E("disciplina")}>
                  <span className="text-sm">{disciplina ?? ""}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-400 text-center text-white" {...E("instituicao")}>
        <p>{instituicao ?? ""}</p>
      </div>
    </div>
  );
}

function Layout2({
  logoUrl, logoPlaceholder, onLogoClick, isEditable,
  nome, turma, professor, disciplina, data, nota, instituicao,
  onFieldChange,
}: ProvaHeaderProps) {
  const E = (f: string) => ed(f, !!isEditable, onFieldChange);
  return (
    <div className="border-2 border-gray-800 w-[18cm] mb-4">
      <div className="grid grid-cols-[2cm_1fr] border-b-2 border-gray-800 bg-gray-400">
        <div
          className={`flex items-center justify-center p-1 ${isEditable ? "cursor-pointer" : "cursor-default"}`}
          onClick={isEditable ? onLogoClick : undefined}
        >
          {logoUrl ? (
            <img src={logoUrl} alt="Logo da instituição" className="object-contain" style={{ maxWidth: "min(100%, 2cm)", maxHeight: "min(100%, 2cm)" }} />
          ) : (
            <span className="text-xs font-bold text-white">{logoPlaceholder?.trim() ?? ""}</span>
          )}
        </div>
        <div className="flex items-center px-2 py-1">
          <p className="text-xs font-medium text-white" {...E("instituicao")}>{instituicao ?? ""}</p>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_3cm_2.5cm_2cm] gap-2 p-1.5 border-b-2 border-gray-800">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-0.5">Nome</label>
          <div className="border-b-2 border-gray-800 h-5 flex items-end pb-0.5" {...E("nome")}>
            <span className="text-xs">{nome ?? ""}</span>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-0.5">Turma</label>
          <div className="border-b-2 border-gray-800 h-5 flex items-end pb-0.5" {...E("turma")}>
            <span className="text-xs">{turma ?? ""}</span>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-0.5">Data</label>
          <div className="border-b-2 border-gray-800 h-5 flex items-end pb-0.5" {...E("data")}>
            <span className="text-xs">{formatDateBR(data ?? "")}</span>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-0.5">Nota</label>
          <div className="border-b-2 border-gray-800 h-5 flex items-end pb-0.5" {...E("nota")}>
            <span className="text-xs">{nota ?? ""}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 p-1.5">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-0.5">Professor</label>
          <div className="border-b-2 border-gray-800 h-5 flex items-end pb-0.5" {...E("professor")}>
            <span className="text-xs">{professor ?? ""}</span>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-0.5">Disciplina</label>
          <div className="border-b-2 border-gray-800 h-5 flex items-end pb-0.5" {...E("disciplina")}>
            <span className="text-xs">{disciplina ?? ""}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Layout3({
  logoUrl, logoPlaceholder, onLogoClick, isEditable,
  nome, turma, professor, disciplina, data, nota, instituicao,
  onFieldChange,
}: ProvaHeaderProps) {
  const E = (f: string) => ed(f, !!isEditable, onFieldChange);
  return (
    <div className="border-2 border-gray-800 w-[18cm] mb-4">
      <div className="grid grid-cols-12">
        <div
          className={`logo-area [grid-row:auto] flex items-center justify-center text-xs font-bold ${isEditable ? "cursor-pointer" : "cursor-default"} ${logoUrl ? "" : "border-2 border-gray-800"}`}
          onClick={isEditable ? onLogoClick : undefined}
        >
          {logoUrl ? (
            <img src={logoUrl} alt="Logo da instituição" className="object-contain" style={{ maxWidth: "min(100%, 2cm)", maxHeight: "min(100%, 2cm)" }} />
          ) : (
            <span className="text-xs font-bold">{logoPlaceholder?.trim() ?? ""}</span>
          )}
        </div>

        <div className="col-span-5 p-3 border-r-2 border-gray-800 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nome</label>
            <div className="border-b-2 border-gray-800 h-6 flex items-end pb-1" {...E("nome")}>
              <span className="text-sm">{nome ?? ""}</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Turma</label>
              <div className="border-b-2 border-gray-800 h-6 flex items-end pb-1" {...E("turma")}>
                <span className="text-sm">{turma ?? ""}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Data</label>
              <div className="border-b-2 border-gray-800 h-6 flex items-end pb-1" {...E("data")}>
                <span className="text-sm">{formatDateBR(data ?? "")}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nota</label>
              <div className="border-b-2 border-gray-800 h-6 flex items-end pb-1" {...E("nota")}>
                <span className="text-sm">{nota ?? ""}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-5 p-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Professor</label>
            <div className="border-b-2 border-gray-800 h-6 flex items-end pb-1" {...E("professor")}>
              <span className="text-sm">{professor ?? ""}</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Disciplina</label>
            <div className="border-b-2 border-gray-800 h-6 flex items-end pb-1" {...E("disciplina")}>
              <span className="text-sm">{disciplina ?? ""}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-400 text-white px-3 flex items-center justify-between" {...E("instituicao")}>
        <p className="text-sm font-medium">{instituicao ?? ""}</p>
      </div>
    </div>
  );
}

function Layout4({
  logoUrl, logoPlaceholder, onLogoClick, isEditable,
  nome, turma, professor, disciplina, data, nota, instituicao,
  onFieldChange,
}: ProvaHeaderProps) {
  const E = (f: string) => ed(f, !!isEditable, onFieldChange);
  return (
    <div className="border-0 border-gray-800 w-[18cm] mb-4">
      <div className="bg-gray-400 text-white px-3 text-center" {...E("instituicao")}>
        <p className="text-sm font-medium">{instituicao ?? ""}</p>
      </div>

      <div className="grid grid-cols-12">
        <div
          className={`logo-area [grid-row:auto] flex items-center justify-center text-xs font-bold ${isEditable ? "cursor-pointer" : "cursor-default"} ${logoUrl ? "" : "border-2 border-gray-800"}`}
          onClick={isEditable ? onLogoClick : undefined}
        >
          {logoUrl ? (
            <img src={logoUrl} alt="Logo da instituição" className="object-contain" style={{ maxWidth: "min(100%, 2cm)", maxHeight: "min(100%, 2cm)" }} />
          ) : (
            <span className="text-xs font-bold">{logoPlaceholder?.trim() ?? ""}</span>
          )}
        </div>

        <div className="col-span-10 p-2 space-y-2">
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-9">
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Nome</label>
              <div className="border-b-2 border-gray-800 h-6 flex items-end pb-0.5" {...E("nome")}>
                <span className="text-sm">{nome ?? ""}</span>
              </div>
            </div>
            <div className="col-span-3">
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Turma</label>
              <div className="border-b-2 border-gray-800 h-6 flex items-end pb-0.5" {...E("turma")}>
                <span className="text-sm">{turma ?? ""}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Professor</label>
              <div className="border-b-2 border-gray-800 h-6 flex items-end pb-0.5" {...E("professor")}>
                <span className="text-sm">{professor ?? ""}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Disciplina</label>
              <div className="border-b-2 border-gray-800 h-6 flex items-end pb-0.5" {...E("disciplina")}>
                <span className="text-sm">{disciplina ?? ""}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Data</label>
              <div className="border-b-2 border-gray-800 h-6 flex items-end pb-0.5" {...E("data")}>
                <span className="text-sm">{formatDateBR(data ?? "")}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Nota</label>
              <div className="border-b-2 border-gray-800 h-6 flex items-end pb-0.5" {...E("nota")}>
                <span className="text-sm">{nota ?? ""}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Layout5({
  logoUrl, logoPlaceholder, onLogoClick, isEditable,
  nome, turma, professor, disciplina, data, nota, instituicao,
  onFieldChange,
}: ProvaHeaderProps) {
  const E = (f: string) => ed(f, !!isEditable, onFieldChange);
  return (
    <div className="w-[18cm] mb-4">
      <div className="flex items-center justify-between border-b-2 border-gray-900 pb-1 mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div
            className={`flex items-center justify-center shrink-0 w-[2cm] ${isEditable ? "cursor-pointer" : "cursor-default"} ${logoUrl ? "" : "border border-gray-400 text-[8px]"}`}
            onClick={isEditable ? onLogoClick : undefined}
          >
            {logoUrl ? (
              <img src={logoUrl} alt="Logo da instituição" className="object-contain" style={{ maxWidth: "2cm" }} />
            ) : (
              <span className="text-xs font-bold">{logoPlaceholder?.trim() ?? ""}</span>
            )}
          </div>
          {/* flex-1 garante que a faixa cinza ocupe o espaço disponível */}
          <div className="instituicao-footer flex-1" {...E("instituicao")}>
            <p>{instituicao ?? ""}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-right shrink-0 ml-2">
          <div>
            <p className="text-[9px] text-gray-500 uppercase">Turma</p>
            <p className="text-xs font-bold text-gray-900" {...E("turma")}>{turma || "—"}</p>
          </div>
          <div>
            <p className="text-[9px] text-gray-500 uppercase">Data</p>
            <p className="text-xs font-bold text-gray-900" {...E("data")}>{formatDateBR(data ?? "") || "—"}</p>
          </div>
          <div className="bg-gray-900 text-white px-2 py-1">
            <p className="text-[9px] uppercase">Nota</p>
            <p className="text-sm font-bold" {...E("nota")}>{nota || "—"}</p>
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex gap-1">
          <span className="text-[10px] font-semibold text-gray-600 w-16">Aluno:</span>
          <span className="text-xs text-gray-900 flex-1 border-b border-gray-300 flex items-end" {...E("nome")}>{nome || ""}</span>
        </div>
        <div className="flex gap-4">
          <div className="flex gap-1 flex-1">
            <span className="text-[10px] font-semibold text-gray-600 w-16">Professor:</span>
            <span className="text-xs text-gray-900 flex-1 border-b border-gray-300 flex items-end" {...E("professor")}>{professor || ""}</span>
          </div>
          <div className="flex gap-1 flex-1">
            <span className="text-[10px] font-semibold text-gray-600 w-20">Disciplina:</span>
            <span className="text-xs text-gray-900 flex-1 border-b border-gray-300 flex items-end" {...E("disciplina")}>{disciplina || ""}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Layout6({
  logoUrl, logoPlaceholder, onLogoClick, isEditable,
  nome, turma, professor, disciplina, data, nota, instituicao,
  onFieldChange,
}: ProvaHeaderProps) {
  const E = (f: string) => ed(f, !!isEditable, onFieldChange);
  return (
    <div className="border border-gray-300 w-[18cm] mb-4 text-[10px]">
      <div className="grid grid-cols-[2cm_1fr_2.5cm] gap-2 px-2 py-1 border-b border-gray-300 items-end">
        <div
          className={`flex items-center justify-center shrink-0 ${isEditable ? "cursor-pointer" : "cursor-default"} ${logoUrl ? "" : "border border-gray-400 text-[8px]"}`}
          onClick={isEditable ? onLogoClick : undefined}
        >
          {logoUrl ? (
            <img src={logoUrl} alt="Logo da instituição" className="object-contain" style={{ maxWidth: "2cm" }} />
          ) : (
            <span>{logoPlaceholder?.trim() ?? ""}</span>
          )}
        </div>

        <div className="flex items-end gap-1">
          <span className="text-gray-400 shrink-0">Nome:</span>
          <div className="flex-1 border-b border-gray-400 min-h-[14px] flex items-end" {...E("nome")}>
            <span>{nome ?? ""}</span>
          </div>
        </div>

        <div className="flex items-end gap-1">
          <span className="text-gray-400 shrink-0">Turma:</span>
          <div className="flex-1 border-b border-gray-400 min-h-[14px] flex items-end" {...E("turma")}>
            <span>{turma ?? ""}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_1fr_2.5cm_1.5cm] gap-2 px-2 py-1 border-b border-gray-300 items-end">
        <div className="flex items-end gap-1">
          <span className="text-gray-400 shrink-0">Prof.:</span>
          <div className="flex-1 border-b border-gray-400 min-h-[14px] flex items-end" {...E("professor")}>
            <span>{professor ?? ""}</span>
          </div>
        </div>

        <div className="flex items-end gap-1">
          <span className="text-gray-400 shrink-0">Disc.:</span>
          <div className="flex-1 border-b border-gray-400 min-h-[14px] flex items-end" {...E("disciplina")}>
            <span>{disciplina ?? ""}</span>
          </div>
        </div>

        <div className="flex items-end gap-1">
          <span className="text-gray-400 shrink-0">Data:</span>
          <div className="flex-1 border-b border-gray-400 min-h-[14px] flex items-end" {...E("data")}>
            <span>{formatDateBR(data ?? "")}</span>
          </div>
        </div>

        <div className="flex items-end gap-1">
          <span className="text-gray-400 shrink-0">Nota:</span>
          <div className="flex-1 border-b border-gray-400 min-h-[14px] flex items-end" {...E("nota")}>
            <span>{nota ?? ""}</span>
          </div>
        </div>
      </div>

      <div className="instituicao-footer" {...E("instituicao")}>
        <p>{instituicao ?? ""}</p>
      </div>
    </div>
  );
}

function Layout7({
  logoUrl, logoPlaceholder, onLogoClick, isEditable,
  nome, turma, professor, disciplina, data, nota, instituicao,
  onFieldChange,
}: ProvaHeaderProps) {
  const E = (f: string) => ed(f, !!isEditable, onFieldChange);
  return (
    <div className="w-[18cm] border border-gray-200 mb-4">
      <div className="flex items-stretch border-b border-gray-200">
        <div
          className={`flex items-center justify-center px-4 py-1 bg-white border-r border-gray-200 shrink-0 ${isEditable ? "cursor-pointer" : "cursor-default"} ${logoUrl ? "" : "text-[8px] text-gray-400"}`}
          style={{ width: "2.5cm" }}
          onClick={isEditable ? onLogoClick : undefined}
        >
          {logoUrl ? (
            <img src={logoUrl} alt="Logo da instituição" className="object-contain" style={{ maxWidth: "2cm" }} />
          ) : (
            <span className="text-xs font-bold">{logoPlaceholder?.trim() ?? ""}</span>
          )}
        </div>
        <div className="instituicao-footer flex-1" style={{ borderRadius: 0, margin: 0 }} {...E("instituicao")}>
          <p>{instituicao ?? ""}</p>
        </div>
      </div>

      <div className="p-2 space-y-1.5">
        <div>
          <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Aluno</label>
          <div className="mt-0.5 text-sm font-medium text-gray-900 border-b border-gray-300 pb-0.5 min-h-[16px] flex items-end" {...E("nome")}>
            {nome || ""}
          </div>
        </div>

        <div className="grid grid-cols-[2.5cm_1fr_1fr_2.5cm_1.5cm] gap-2">
          <div>
            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Turma</label>
            <div className="mt-0.5 text-xs font-medium text-gray-900 border-b border-gray-300 pb-0.5 min-h-[14px] flex items-end" {...E("turma")}>
              {turma || ""}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Professor</label>
            <div className="mt-0.5 text-xs font-medium text-gray-900 border-b border-gray-300 pb-0.5 min-h-[14px] flex items-end" {...E("professor")}>
              {professor || ""}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Disciplina</label>
            <div className="mt-0.5 text-xs font-medium text-gray-900 border-b border-gray-300 pb-0.5 min-h-[14px] flex items-end" {...E("disciplina")}>
              {disciplina || ""}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Data</label>
            <div className="mt-0.5 text-xs font-medium text-gray-900 border-b border-gray-300 pb-0.5 min-h-[14px] flex items-end" {...E("data")}>
              {formatDateBR(data ?? "")}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Nota</label>
            <div className="mt-0.5 text-xs font-medium text-gray-900 border-b border-gray-300 pb-0.5 min-h-[14px] flex items-end" {...E("nota")}>
              {nota || ""}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Layout8({
  logoUrl, logoPlaceholder, onLogoClick, isEditable,
  nome, turma, professor, disciplina, data, nota, instituicao,
  onFieldChange,
}: ProvaHeaderProps) {
  const E = (f: string) => ed(f, !!isEditable, onFieldChange);
  return (
    <div className="w-[18cm] border border-gray-300 mb-4">
      <div className="bg-gray-400 text-white py-1 px-3 flex items-center justify-between">
        <div
          className={`flex items-center justify-center shrink-0 text-xs font-bold ${isEditable ? "cursor-pointer" : "cursor-default"} ${logoUrl ? "" : "border-2 border-white/60"}`}
          style={{ width: "2cm" }}
          onClick={isEditable ? onLogoClick : undefined}
        >
          {logoUrl ? (
            <img src={logoUrl} alt="Logo da instituição" className="object-contain" style={{ maxWidth: "2cm", maxHeight: "0.7cm" }} />
          ) : (
            <span className="text-xs font-bold">{logoPlaceholder?.trim() ?? ""}</span>
          )}
        </div>
        <span className="flex-1 text-center text-sm font-bold" {...E("instituicao")}>{instituicao ?? ""}</span>
      </div>

      <div className="divide-y divide-gray-200">
        <div className="grid grid-cols-12 bg-white">
          <div className="col-span-2 px-2 py-1 bg-gray-50 border-r border-gray-200">
            <span className="text-[10px] font-semibold text-gray-600">Nome:</span>
          </div>
          <div className="col-span-10 px-2 py-1">
            <span className="text-xs text-gray-900" {...E("nome")}>{nome || "—"}</span>
          </div>
        </div>

        <div className="grid grid-cols-12">
          <div className="col-span-2 px-2 py-1 bg-gray-100 border-r border-gray-200">
            <span className="text-[10px] font-semibold text-gray-600">Professor:</span>
          </div>
          <div className="col-span-4 px-2 py-1 border-r border-gray-200">
            <span className="text-xs text-gray-900" {...E("professor")}>{professor || "—"}</span>
          </div>
          <div className="col-span-2 px-2 py-1 bg-gray-100 border-r border-gray-200">
            <span className="text-[10px] font-semibold text-gray-600">Disciplina:</span>
          </div>
          <div className="col-span-4 px-2 py-1">
            <span className="text-xs text-gray-900" {...E("disciplina")}>{disciplina || "—"}</span>
          </div>
        </div>

        <div className="grid grid-cols-12 bg-white">
          <div className="col-span-2 px-2 py-1 bg-gray-50 border-r border-gray-200">
            <span className="text-[10px] font-semibold text-gray-600">Turma:</span>
          </div>
          <div className="col-span-4 px-2 py-1 border-r border-gray-200">
            <span className="text-xs text-gray-900" {...E("turma")}>{turma || "—"}</span>
          </div>
          <div className="col-span-2 px-2 py-1 bg-gray-50 border-r border-gray-200">
            <span className="text-[10px] font-semibold text-gray-600">Data:</span>
          </div>
          <div className="col-span-2 px-2 py-1 border-r border-gray-200">
            <span className="text-xs text-gray-900" {...E("data")}>{formatDateBR(data ?? "") || "—"}</span>
          </div>
          <div className="col-span-1 px-2 py-1 bg-gray-50 border-r border-gray-200">
            <span className="text-[10px] font-semibold text-gray-600">Nota:</span>
          </div>
          <div className="col-span-1 px-2 py-1">
            <span className="text-xs text-gray-900" {...E("nota")}>{nota || "—"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Layout9({
  logoUrl, logoPlaceholder, onLogoClick, isEditable,
  nome, turma, professor, disciplina, data, nota, instituicao,
  onFieldChange,
}: ProvaHeaderProps) {
  const E = (f: string) => ed(f, !!isEditable, onFieldChange);
  return (
    <div className="w-[18cm] flex border border-gray-300 mb-4">
      <div className="w-3 bg-gradient-to-b from-blue-600 to-blue-800 shrink-0"></div>

      <div className="flex-1 min-w-0">
        <div className="grid grid-cols-[2cm_1fr_auto] gap-3 items-center px-3 py-1.5 bg-gray-50 border-b border-gray-200">
          <div
            className={`flex items-center justify-center shrink-0 ${isEditable ? "cursor-pointer" : "cursor-default"} ${logoUrl ? "" : "text-[8px] text-gray-400"}`}
            onClick={isEditable ? onLogoClick : undefined}
          >
            {logoUrl ? (
              <img src={logoUrl} alt="Logo da instituição" className="object-contain" style={{ maxWidth: "2cm" }} />
            ) : (
              <span className="text-xs font-bold">{logoPlaceholder?.trim() ?? ""}</span>
            )}
          </div>

          <div className="instituicao-footer px-2" {...E("instituicao")}>
            <p>{instituicao ?? ""}</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[9px] text-gray-500">Data</p>
              <p className="text-xs font-semibold text-gray-800" {...E("data")}>{formatDateBR(data ?? "") || "—"}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-gray-500">Nota</p>
              <p className="text-xs font-semibold text-blue-700" {...E("nota")}>{nota || "—"}</p>
            </div>
          </div>
        </div>

        <div className="px-3 py-2 space-y-1.5">
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] font-semibold text-gray-500 uppercase w-16 shrink-0">Aluno:</span>
            <span className="text-xs text-gray-900 flex-1 border-b border-dotted border-gray-300 flex items-end min-h-[14px]" {...E("nome")}>{nome || ""}</span>
          </div>

          <div className="flex gap-4">
            <div className="flex items-baseline gap-2 flex-1">
              <span className="text-[10px] font-semibold text-gray-500 uppercase w-16 shrink-0">Professor:</span>
              <span className="text-xs text-gray-900 flex-1 border-b border-dotted border-gray-300 flex items-end" {...E("professor")}>{professor || ""}</span>
            </div>
            <div className="flex items-baseline gap-2 flex-1">
              <span className="text-[10px] font-semibold text-gray-500 uppercase w-16 shrink-0">Disciplina:</span>
              <span className="text-xs text-gray-900 flex-1 border-b border-dotted border-gray-300 flex items-end" {...E("disciplina")}>{disciplina || ""}</span>
            </div>
            <div className="flex items-baseline gap-2 w-[3cm]">
              <span className="text-[10px] font-semibold text-gray-500 uppercase shrink-0">Turma:</span>
              <span className="text-xs text-gray-900 flex-1 border-b border-dotted border-gray-300 flex items-end" {...E("turma")}>{turma || ""}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Layout10({
  logoUrl, logoPlaceholder, onLogoClick, isEditable,
  nome, turma, professor, disciplina, data, nota, instituicao,
  onFieldChange,
}: ProvaHeaderProps) {
  const E = (f: string) => ed(f, !!isEditable, onFieldChange);
  return (
    <div className="mb-[1cm] px-1 py-1 rounded-[5px] border-1 border-gray-800 w-[18cm]">
      <div className="grid grid-cols-[2cm_1fr_4cm] gap-[0.15cm] mb-[0.00cm] items-stretch">
        <div
          className={`logo-area [grid-row:auto] flex items-center justify-center text-xs font-bold ${isEditable ? "cursor-pointer" : "cursor-default"} ${logoUrl ? "" : "border-2 border-gray-800"}`}
          onClick={isEditable ? onLogoClick : undefined}
        >
          {logoUrl ? (
            <img src={logoUrl} alt="Logo da instituição" className="object-contain" style={{ maxWidth: "min(100%, 2cm)", maxHeight: "min(100%, 2cm)" }} />
          ) : (
            <span className="text-xs font-bold">{logoPlaceholder?.trim() ?? ""}</span>
          )}
        </div>

        <div className="relative pt-2">
          <div className="absolute top-0 left-[6px] text-[7pt] font-normal bg-white px-[3px] z-[1]">Nome</div>
          <div className="border border-black rounded-[5px] py-1 px-[6px] min-h-[22px] outline-none w-full box-border focus:bg-[#f9f9f9] flex items-end" {...E("nome")}>
            <span className="leading-[1.1]">{nome ?? ""}</span>
          </div>
        </div>

        <div className="relative pt-2">
          <div className="absolute top-0 left-[6px] text-[7pt] font-normal bg-white px-[3px] z-[1]">Turma</div>
          <div className="border border-black rounded-[5px] py-1 px-[6px] min-h-[22px] outline-none w-full box-border focus:bg-[#f9f9f9] flex items-end" {...E("turma")}>
            <span className="leading-[1.1]">{turma ?? ""}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_1fr_3cm_3cm] gap-[0.15cm] mb-[0.05cm] items-stretch">
        <div className="relative pt-2">
          <div className="absolute top-0 left-[6px] text-[7pt] font-normal bg-white px-[3px] z-[1]">Professor</div>
          <div className="border border-black rounded-[5px] py-1 px-[6px] min-h-[22px] outline-none w-full box-border focus:bg-[#f9f9f9] flex items-end" {...E("professor")}>
            <span className="leading-[1.1]">{professor ?? ""}</span>
          </div>
        </div>

        <div className="relative pt-2">
          <div className="absolute top-0 left-[6px] text-[7pt] font-normal bg-white px-[3px] z-[1]">Disciplina</div>
          <div className="border border-black rounded-[5px] py-1 px-[6px] min-h-[22px] outline-none w-full box-border focus:bg-[#f9f9f9] flex items-end" {...E("disciplina")}>
            <span className="leading-[1.1]">{disciplina ?? ""}</span>
          </div>
        </div>

        <div className="relative pt-2">
          <div className="absolute top-0 left-[6px] text-[7pt] font-normal bg-white px-[3px] z-[1]">Data</div>
          <div className="border border-black rounded-[5px] py-1 px-[6px] min-h-[22px] outline-none w-full box-border focus:bg-[#f9f9f9] flex items-end" {...E("data")}>
            <span className="leading-[1.1]">{formatDateBR(data ?? "")}</span>
          </div>
        </div>

        <div className="relative pt-2">
          <div className="absolute top-0 left-[6px] text-[7pt] font-normal bg-white px-[3px] z-[1]">Nota</div>
          <div className="border border-black rounded-[5px] py-1 px-[6px] min-h-[22px] outline-none w-full box-border focus:bg-[#f9f9f9] flex items-end" {...E("nota")}>
            <span className="leading-[1.1]">{nota ?? ""}</span>
          </div>
        </div>
      </div>

      <div
        className="bg-[#666] text-white text-center p-[3px] font-bold outline-none mt-[0.1cm] rounded-[5px] [print-color-adjust:exact] [-webkit-print-color-adjust:exact]"
        {...E("instituicao")}
      >
        {instituicao ?? ""}
      </div>
    </div>
  );
}

// ─── componente principal ────────────────────────────────────────────────────

const LAYOUT_MAP: Record<number, React.ComponentType<ProvaHeaderProps>> = {
  0: Layout0,
  1: Layout1,
  2: Layout2,
  3: Layout3,
  4: Layout4,
  5: Layout5,
  6: Layout6,
  7: Layout7,
  8: Layout8,
  9: Layout9,
  10: Layout10,
};

export function ProvaHeader(props: ProvaHeaderProps) {
  const { layout = 0 } = props;
  const LayoutComponent = LAYOUT_MAP[layout] ?? Layout0;
  return <LayoutComponent {...props} />;
}
