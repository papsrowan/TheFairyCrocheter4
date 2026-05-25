declare module "react-barcode" {
  import { FC } from "react";
  interface BarcodeProps {
    value: string;
    format?: string;
    width?: number;
    height?: number;
    fontSize?: number;
    margin?: number;
    background?: string;
    lineColor?: string;
    displayValue?: boolean;
    text?: string;
    textAlign?: string;
    textPosition?: string;
    textMargin?: number;
  }
  const Barcode: FC<BarcodeProps>;
  export default Barcode;
}
