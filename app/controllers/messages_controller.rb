class MessagesController < ApplicationController
  def index
    @messages = Message.all
  end

  def new

    @message = Message.new
  end
  
  def create
    @message = Message.create(message_params)
    MessageMailer.message_email(@message).deliver
    redirect_to messages_path
  end

  private

  def message_params

    params.require(:message).permit(:to, :from, :subject, :body)
    
  end
end
