const asyncHandler = require("express-async-handler");
const User = require("../models/userModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const validator = require("validator");
const axios = require("axios");

//register user============================================================================
const registerUser = asyncHandler(async (req, res, next) => {
  console.log("=====================");

  if (
    (!req.body.name ||
      !req.body.email ||
      !req.body.phone ||
      !req.body.isVerify ||
      !req.body.verificationToken,
    !req.body.password)
  ) {
    res.status(400);
    throw new Error("Name, email,phone,password are required.");
  }
  const email = req.body.email;
  const userAvailable = await User.findOne({ email });
  if (userAvailable) {
    res.status(400);
    throw new Error("User already registered.");
  }
  //hash password
  const hashedPassword = await bcrypt.hash(req.body.password, 10);
  console.log(hashedPassword);
  const user = new User({
    name: req.body.name,
    email: req.body.email,
    phone: req.body.phone,
    address: req.body.address,
    isVerify: validator.toBoolean(req.body.isVerify),
    verificationToken: req.body.verificationToken,
    password: hashedPassword,
  });
  if (req.file) {
    user.imageUrl = req.file.path;
  }

  console.log(user.imageUrl);
  user
    .save()
    .then((response) => {
      res.json({
        message: "Users uploaded.",
        user: user,
      });
    })
    .catch((error) => {
      res.json({
        message: "Error",
      });
    });
});

//verify user=========================================================================================
const verifyUser = asyncHandler(async (req, res) => {
  const user = await User.findOne({
    verificationToken: req.params.id,
  });
  if (!user) {
    res.status(404);
    throw new Error("User not found.");
  }

  user.isVerify = true;
  console.log(user.isVerify);
  await user.save();

  if (user.isVerify) {
    res.render("index");
  } else {
    res.json({
      message: "Error updating user.",
      user: user,
    });
  }
});

//login user======================================================================
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400);
    throw new Error("All fields requeried.");
  }
  const user = await User.findOne({ email });

  if (user && (await bcrypt.compare(password, user.password))) {
    const accessToken = jwt.sign(
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          imageUrl: user.imageUrl,
          password: user.password,
          address: user.address,
          isVerify: user.isVerify,
          verificationToken: user.verificationToken,
        },
      },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );
    res.status(200).json({ accessToken, user });
  } else {
    res.status(401);
    throw new Error("Email or password s incorrecrt.");
  }
});

//current user======================================================================
const currentUser = asyncHandler(async (req, res) => {
  res.json(req.user);
  console.log(req.user);
});

//update user===========================================================================================

const updateUser = asyncHandler(async (req, res) => {
  const { name, email, phone, address, password } = req.body;
  console.log(req.body);

  const userId = req.params.id;
  const user = await User.findById(userId);

  if (!user) {
    res.status(404);
    throw new Error("User not found.");
  }
  console.log(name);
  user.name = name || user.name;
  user.email = email || user.email;
  user.phone = phone || user.phone;
  user.address = address || user.address;
  user.isVerify = user.isVerify;
  user.verificationToken = user.verificationToken;

  if (password) {
    user.password = await bcrypt.hash(password, 10);
  }

  if (req.file) {
    user.imageUrl = req.file.path;
  }

  await user
    .save()
    .then((response) => {
      console.log(response);
      res.json({
        message: "User updated.",
        user: user,
      });
      console.log("=====================================================");
    })
    .catch((error) => {
      res.status(400);
      console.log(error);
      throw new Error("Error updating user.");
    });
});

//foget password
const postForgetPassowrd = asyncHandler(async (req, res, next) => {
  //post
  const { email } = req.body;
  if (!email) {
    res.status(400);
    throw new Error("Email requeried.");
  }
  const user = await User.findOne({ email: email });

  if (!user) {
    res.status(404);
    throw new Error("User not found.");
  }
  //user exist and create one time password link
  const secret = process.env.JWT_SECRET + user.password;
  const payload = {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    imageUrl: user.imageUrl,
    password: user.password,
    address: user.address,
    isVerify: user.isVerify,
    verificationToken: user.verificationToken,
  };

  const token = jwt.sign(payload, secret, { expiresIn: "15m" });
  const link = user.id + "/" + token;
  res.status(200).json(link);
});

const postResetPassowrd = asyncHandler(async (req, res) => {
  //post
  const { password } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error("User not found.");
  }

  const secret = process.env.JWT_SECRET + user.password;
  try {
    const payload = jwt.verify(req.params.token, secret);
    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }

    await user
      .save()
      .then((response) => {
        console.log(response);
        res.json({
          message: "User updated.",
          user: user,
        });
      })
      .catch((error) => {
        res.status(400);
        console.log(error);
        throw new Error("Error updating user.");
      });
  } catch (e) {
    
    if(e.message == "jwt expired"){
      res.status(401).json({ message: 'Invalid token' });
    }else if(e.message == "invalid signature"){
      res.status(404).json({ message: 'Invalid token' });
    }else{
      console.log(e.message);
    }
    
  }
});

//get a user==========================================================================
const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error("Forum not found");
  }
  res.status(200).json(user);
});

//get all users======================================================================
const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find();
  res.status(200).json(users);
});

module.exports = {
  registerUser,
  loginUser,
  currentUser,
  getUser,
  getUsers,
  updateUser,
  verifyUser,
  postForgetPassowrd,
  postResetPassowrd,
};
