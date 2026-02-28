import { QRCodeSVG } from "qrcode.react";

interface QRCodeCardProps {
  value: string;
  size?: number;
}

export function QRCodeCard({ value, size = 200 }: QRCodeCardProps) {
  return (
    <div className="flex justify-center p-4 bg-white rounded-xl">
      <QRCodeSVG value={value} size={size} level="M" includeMargin />
    </div>
  );
}
