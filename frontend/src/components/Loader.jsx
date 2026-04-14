import { ClipLoader } from "react-spinners";

export const PageLoader = ({ loading }) => {
  if (!loading) return null;

  return (
    <div className="d-flex justify-content-center align-items-center vh-100">
      <ClipLoader size={50} color="#0d6efd" />
    </div>
  );
};

export const InlineLoader = ({ size = 18, color = "#fff" }) => {
  return <ClipLoader size={size} color={color} />;
};
