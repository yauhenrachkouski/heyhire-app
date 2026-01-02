import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ProfileAvatarProps {
  fullName?: string | null;
  photoUrl?: string | null;
  className?: string;
}

function getInitials(fullName?: string | null) {
  const value = (fullName || "").trim();
  if (!value) return "?";

  const parts = value.split(/\s+/).filter(Boolean);
  const first = parts[0]?.charAt(0) ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.charAt(0) ?? "" : "";

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
