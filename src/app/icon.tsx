import { ImageResponse } from 'next/og';

const iconSvg = (
  <svg width="220" height="220" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
    <path
      fill="white"
      d="M168,40V176a8,8,0,0,1-16,0V50.8L89.2,210.8a8.2,8.2,0,0,1-7.2,4.4,8.1,8.1,0,0,1-7.2-4.4L42.2,50.8V176a8,8,0,0,1-16,0V40a8,8,0,0,1,8-32h48a8,8,0,0,1,7.2,4.4L128,100.8l28.8-88.4a8,8,0,0,1,7.2-4.4h48a8,8,0,0,1,8,32Z"
    />
  </svg>
);

function IconShell({ size }: { size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(145deg, #111111 0%, #1f1f1f 100%)',
        borderRadius: size * 0.22,
      }}
    >
      {iconSvg}
    </div>
  );
}

export const contentType = 'image/png';
export const size = {
  width: 512,
  height: 512,
};

export default function Icon() {
  return new ImageResponse(<IconShell size={512} />, size);
}
