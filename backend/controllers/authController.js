const bcrypt = require("bcryptjs");
const User = require("../models/User");
const generateToken = require("../utils/generateToken");

const registerUser = async (req, res) => {

  const {
    username,
    email,
    password
  } = req.body;

  if (
    !username ||
    !email ||
    !password
  ) {
    return res.status(400).json({
      message: "Please fill all fields"
    });
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

  const {
    email,
    password
  } = req.body;

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
