"use client";

interface RevokeButtonProps {
  onClick?: () => void;
  disabled?: boolean;
}

export default function RevokeButton({
  onClick,
  disabled = false,
}: RevokeButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded text-white font-medium transition ${
        disabled
          ? "bg-gray-400 cursor-not-allowed"
          : "bg-red-600 hover:bg-red-700"
      }`}
    >
      Revoke
    </button>
  );
}