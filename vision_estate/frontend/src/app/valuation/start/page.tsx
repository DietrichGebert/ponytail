import Intake from "@/components/seller-intake";
export default async function IntakePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  return (
    <Intake
      key={type || "APARTMENT"}
      initialType={
        type && ["APARTMENT", "HOUSE", "LAND"].includes(type)
          ? type
          : "APARTMENT"
      }
    />
  );
}
