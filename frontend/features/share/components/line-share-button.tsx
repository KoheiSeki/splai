'use client';

type Props = {
  url: string;
  text: string;
};

/**
 * LINE Social Plugin で URL を共有する。
 * 仕様: https://developers.line.biz/ja/docs/social-plugins/using-share-button/
 */
export function LineShareButton({ url, text }: Props) {
  const params = new URLSearchParams({ url, text });
  const lineUrl = `https://social-plugins.line.me/lineit/share?${params.toString()}`;

  return (
    <a
      href={lineUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-ink text-paper font-display p-2 inline-block text-center"
    >
      LINE で共有
    </a>
  );
}
