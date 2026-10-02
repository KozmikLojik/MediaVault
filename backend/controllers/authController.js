const bcrypt = require("bcryptjs");
const User = require("../models/User");
const generateToken = require("../utils/generateToken");

const registerUser = async (req, res) => {
  const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (
    !username ||
    !email ||
    !password
  ) {
    return res.status(400).json({
      message: "Please fill all fields"
    });
  }

  if (username.length < 2 || username.length > 40) {
    return res.status(400).json({ message: "Username must be 2–40 characters." });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return res.status(400).json({ message: "Enter a valid email address." });
  }

  if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    return res.status(400).json({ message: "Password must be at least 8 characters and no more than 72 bytes." });
  }

  const userExists =
    await User.findOne({ email });

  if (userExists) {
    return res.status(400).json({
      message: "User already exists"
    });
  }

  const salt =
    await bcrypt.genSalt(10);

  const hashedPassword =
    await bcrypt.hash(
      password,
      salt
    );

  const user =
    await User.create({
      username,
      email,
      password: hashedPassword
    });

  res.status(201).json({
    _id: user._id,
    username: user.username,
    email: user.email,
    token: generateToken(user._id)
  });

};

const loginUser = async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!email || !password) {
    return res.status(400).json({
      message: "Please fill all fields"
    });
  }

  const user =
    await User.findOne({ email });

  if (
    user &&
    (await bcrypt.compare(
      password,
      user.password
    ))
  ) {

    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      token: generateToken(user._id)
    });

  } else {

    res.status(401).json({
      message: "Invalid credentials"
    });

  }

};

const getMe = async (req, res) => {

  res.json(req.user);

};

module.exports = {
  registerUser,
  loginUser,
  getMe
};
