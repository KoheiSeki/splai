'use client';

import { QRCodeSVG } from 'qrcode.react';

/**
 * グループ URL を QR コードとして描画する。
 *
 * `qrcode.react` の `QRCodeSVG` は **同期** で SVG を返す Client Component。
 * `qrcode` パッケージの Promise ベース API を Server Component として呼ぶ
 * 当初設計だと、親(group-dashboard など)が Client Component の場合に
 * 「async Client Component は未サポート」エラーが出るため、Client 側で
 * 同期描画する形に変更した。
 *
 * 配色は設計書 §12.3:
 * - fg(QR の本体): `--ink` #0A0A0A
 * - bg(背景): `--paper` #F4F1E8
 *   `--red`(#E8000C)は AI 動作中以外で使用禁止のため不使用。
 */
type Props = {
  value: string;
  size?: number; // px
};

export function QrCode({ value, size = 192 }: Props) {
  return (
    <QRCodeSVG
      value={value}
      size={size}
      fgColor="#0A0A0A"
      bgColor="#F4F1E8"
      level="M"
      marginSize={2}
      role="img"
      aria-label={`QR code for ${value}`}
      className="block border-2 border-ink"
    />
  );
}
