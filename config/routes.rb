Rails.application.routes.draw do
  devise_for :users
  
  resources :messages


  scope '/api' do
    resources :campaigns
  end

  root 'welcome#index'
   get '*anything', to: "welcome#index"

end
