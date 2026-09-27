const Support = require('../models/Support');
const asyncHandler = require('../utils/asyncHandler');

const getMySupport = asyncHandler(async (req,res)=>{
  const conversation=await Support.getOrCreateConversation(req.user.id);
  res.json({conversation,messages:await Support.messages(conversation.id)});
});
const sendSupportMessage = asyncHandler(async (req,res)=>{
  const message=String(req.body.message||'').trim();
  if(!message) return res.status(400).json({error:'Message is required'});
  if(message.length>2000) return res.status(400).json({error:'Message is too long'});
  const conversation=await Support.getOrCreateConversation(req.user.id);
  const saved=await Support.addMessage(conversation.id,req.user.id,message);
  res.status(201).json({message:saved});
});
const listSupport = asyncHandler(async (req,res)=>res.json({conversations:await Support.listConversations()}));
const getSupport = asyncHandler(async (req,res)=>{
  const conversation=await Support.findConversation(req.params.id);
  if(!conversation) return res.status(404).json({error:'Conversation not found'});
  res.json({conversation,messages:await Support.messages(conversation.id)});
});
const replySupport = asyncHandler(async (req,res)=>{
  const message=String(req.body.message||'').trim();
  if(!message) return res.status(400).json({error:'Message is required'});
  if(message.length>2000) return res.status(400).json({error:'Message is too long'});
  const conversation=await Support.findConversation(req.params.id);
  if(!conversation) return res.status(404).json({error:'Conversation not found'});
  const saved=await Support.addMessage(conversation.id,req.user.id,message);
  res.status(201).json({message:saved});
});
module.exports={getMySupport,sendSupportMessage,listSupport,getSupport,replySupport};