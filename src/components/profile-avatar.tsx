import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ProfileAvatarProps {
  fullName?: string | null;
  photoUrl?: string | null;
  className?: string;
}

function getInitials(fullName?: string | null) {
  const value = (fullName || "").trim();
  if (!value) return "?";

  // Remove emojis to avoid hydration mismatches (emojis are surrogate pairs)
  const cleanValue = value.replace(/\p{Emoji}/gu, "").trim();
  if (!cleanValue) return "?";

  const parts = cleanValue.split(/\s+/).filter(Boolean);
  // Use Array.from to properly handle Unicode characters
  const first = Array.from(parts[0] || "")[0] ?? "";
  const last =
    parts.length > 1 ? Array.from(parts[parts.length - 1] || "")[0] ?? "" : "";

  const initials = `${first}${last}`.toUpperCase();
  return initials || "?";
}

export function ProfileAvatar({
  fullName,
  photoUrl,
  className,
}: ProfileAvatarProps) {
  const initials = getInitials(fullName);

  return (
    <Avatar className={className}>
      {photoUrl && <AvatarImage src={photoUrl} alt={fullName || "Avatar"} />}
      <AvatarFallback className="font-bold text-sm">{initials}</AvatarFallback>
    </Avatar>
  );
}
