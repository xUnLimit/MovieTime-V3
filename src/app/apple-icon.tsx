import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: '#7c3aed',
          borderRadius: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="110" height="110" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
          <path
            fill="white"
            d="M168,40V176a8,8,0,0,1-16,0V50.8L89.2,210.8a8.2,8.2,0,0,1-7.2,4.4,8.1,8.1,0,0,1-7.2-4.4L42.2,50.8V176a8,8,0,0,1-16,0V40a8,8,0,0,1,8-32h48a8,8,0,0,1,7.2,4.4L128,100.8l28.8-88.4a8,8,0,0,1,7.2-4.4h48a8,8,0,0,1,8,32Z"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
