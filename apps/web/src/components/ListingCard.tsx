interface ListingCardProps {
  id: string;
  title: string;
  city: string;
  price: number;
  beds: number;
  baths: number;
  imageUrl: string;
}

export function ListingCard({ title, city, price, beds, baths, imageUrl }: ListingCardProps) {
  return (
    <div className="rounded-2xl overflow-hidden bg-white/5 border border-white/10 shadow-xl">
      <div className="aspect-[4/3] bg-slate-700 relative">
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="p-4 space-y-1">
        <h3 className="text-lg font-semibold text-white truncate">{title}</h3>
        <p className="text-slate-400 text-sm">{city}</p>
        <div className="flex items-center justify-between pt-2">
          <span className="text-white font-medium">${price.toLocaleString()}/mo</span>
          <span className="text-slate-400 text-sm">
            {beds} bed · {baths} bath
          </span>
        </div>
      </div>
    </div>
  );
}
