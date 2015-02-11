Rails.application.routes.draw do
  devise_for :users
  
  resources :messages


  scope '/api' do
    resources :campaigns
  end

  mount Rapidfire::Engine => "/rapidfire"

  root 'welcome#index'
   get '*anything', to: "welcome#index"

end
