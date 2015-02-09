class MessageMailer < ApplicationMailer
  def message_email(message)
    @message = message 
    mail to: @message.to, from: @message.from, subject: @message.subject
  end
end
