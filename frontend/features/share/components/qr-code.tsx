import QRCode from 'qrcode';

type Props = {
  value: string;
  size?: number; // px
};

export async function QrCode({ value, size = 192 }: Props) {
  const dataUrl = await QRCode.toDataURL(value, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: size,
    color: { dark: '#0A0A0A', light: '#F4F1E8' }, // ink on paper
  });

  return (
    // alt に value を入れて scanner が無くても URL を確認できるように
    <img
      src={dataUrl}
      alt={`QR code for ${value}`}
      width={size}
      height={size}
      className="block border-2 border-ink"
    />
  );
}
