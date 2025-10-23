import { Separator } from "@/components/ui/separator";
import Image from "next/image";

export const AvatarStack = () => {
  const avatars = [
    {
      id: 1,
      image_url:
        "https://media.licdn.com/dms/image/v2/D5603AQFLQdsKi_0STQ/profile-displayphoto-shrink_200_200/B56ZaWyqq.HsAY-/0/1746286591009?e=2147483647&v=beta&t=8VwKNng-QU__XMiL5yp3WFuVhO8SC4G4saLH78u_7Ps",
    },
    {
      id: 2,
      image_url:
        "https://media.licdn.com/dms/image/v2/C5603AQEgwyywvejkMA/profile-displayphoto-shrink_200_200/profile-displayphoto-shrink_200_200/0/1594162499295?e=2147483647&v=beta&t=0mt63iQWiUqEK5HdjVZKEg-F6ib7mxuPrGFseBuNaMw",
    },
    {
      id: 3,
      image_url:
        "https://media.licdn.com/dms/image/v2/D5603AQEyioXbXyT6-w/profile-displayphoto-shrink_200_200/profile-displayphoto-shrink_200_200/0/1664925338223?e=2147483647&v=beta&t=LodhZuseuaerjHqU5EDG6cl0BKHczYFjpdSjfrgnccw",
    },
    {
      id: 4,
      image_url:
        "https://media.licdn.com/dms/image/v2/C5103AQEFYg1W_oI-VA/profile-displayphoto-shrink_200_200/profile-displayphoto-shrink_200_200/0/1516555986262?e=2147483647&v=beta&t=DT-D__YBG7LQ0xWjRmKJlmoq6A0PreAT_--TmokjVow",
    },
    {
      id: 5,
      image_url:
        "https://media.licdn.com/dms/image/v2/D5603AQH7_64RXs6GVg/profile-displayphoto-shrink_200_200/profile-displayphoto-shrink_200_200/0/1680490398676?e=2147483647&v=beta&t=_KvRlvnmp0LUcuc1RjKDA4S6iMmXLjdJj9S-HbJsw-8",
    },
  ];

  return (
    <div className="flex w-fit items-center overflow-hidden rounded-full border bg-background p-1 shadow-xs gap-2">
      <div className="-space-x-3 flex">
        {avatars.map((avatar) => (
          <div
            key={avatar.id}
            className="size-[28px] overflow-hidden rounded-full border-[2.5px] border-background"
          >
            <Image
              src={avatar.image_url}
              alt={`Avatar ${avatar.id}`}
              width={28}
              height={28}
              className="h-full w-full object-cover"
            />
          </div>
        ))}
      </div>
      <Separator orientation="vertical" className="h-5" />
      <div className="mr-2 truncate font-medium text-sm">100mln+ candidates profiles</div>
    </div>
  );
};
