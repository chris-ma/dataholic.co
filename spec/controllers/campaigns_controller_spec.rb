require 'rails_helper'
require 'factory_girl_rails'


RSpec.describe CampaignsController, :type => :controller do
  describe "GET /campaigns.json" do
    it "responds with all campaigns" do
      campaigns = create_list(:campaign, 1)

      get :index, format: :json

      expect(response.body).to eq(campaigns.to_json)
    end
  end

  describe "POST /campaigns.json" do
    it "creates a new campaign" do
      expect{
        post :create, format: :json, campaign: attributes_for(:campaign)
      }.to change { Campaign.count }.by(1)

    end
    it "responds with the campaign name" do
      campaign_attributes = attributes_for(:campaign)
      post :create, format: :json, campaign: campaign_attributes

      expect(response.body).to include(campaign_attributes[:name])
      expect(response.body).to include(campaign_attributes[:description])
    end
  end 
    describe "PUT /campaigns/:id.json" do
      it "updates a campaign" do
        campaign = create(:campaign)

        expect {
          put :update, id: campaign.id, format: :json, campaign: { name: "Global"}
          }.to change {
            c = Campaign.find(campaign.id)
            c.name
          }
        end
      it "responds with the campaign" do
        campaign = create(:campaign)
        put :update, id: campaign.id, format: :json, campaign: { name: "Global"}
        expect(response.body).to include("Global")
       

      end
    end

      describe "DELETE /campaigns/:id.json" do
      it "deletes the campaign" do
        campaign = create(:campaign)

        expect {
          delete :destroy, id: campaign.id, format: :json
        }.to change { Campaign.count }.from(1).to(0)
      end

      it "responds with a basic object" do
        campaign = create(:campaign)

        delete :destroy, id: campaign.id, format: :json

        expect(response.body).to eq("{\"status\":\"OK\"}")
      end
    end


end
