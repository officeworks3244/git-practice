// utils/generateToken.js
import jwt from "jsonwebtoken";

const generateToken = async (data) => {
  try {
    const token = jwt.sign({ data }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN,
    });
    return token;
  } catch (err) {
    throw err; // 'next' use na karo, throw kar do aur controller me catch handle karega
  }
};

export default generateToken;
